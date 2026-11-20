import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, SystemPermission } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { IntakeService, normalizeIntakeText } from './intake.service';
import { ConnectorsService } from './connectors.service';
import { throwProviderFailure } from './provider-failure';
import {
  AccessPolicyDto,
  AccessPreviewDto,
  AccessResourceDto,
  CreateLifecycleDto,
  LifecycleDecisionDto,
  LifecycleQueryDto,
  OperationEvidenceDto,
  UpdateAccessPolicyDto,
  UpdateAccessResourceDto,
} from './lifecycle.dto';
import {
  assertDecision,
  assertOperationIdentity,
  assertScope,
  policyMatches,
  protectAdminLinks,
} from './lifecycle.rules';

const processInclude = {
  operations: {
    include: { evidence: { orderBy: { createdAt: 'asc' as const } } },
    orderBy: { createdAt: 'asc' as const },
  },
  approvals: true,
};

@Injectable()
export class LifecycleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly intake: IntakeService,
    private readonly connectors: ConnectorsService,
  ) {}

  async actor(id: string, permission: SystemPermission) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        departmentId: true,
        userRoles: { select: { role: { select: { permissions: true } } } },
      },
    });
    const permissions = [
      ...new Set(
        user?.userRoles.flatMap((value) => value.role.permissions) || [],
      ),
    ];
    if (
      !user ||
      user.status !== 'ACTIVE' ||
      !permissions.includes(permission) ||
      !permissions.includes('ACCESS_READ')
    )
      throw new ForbiddenException(
        'Operador sem permissão para gerir estes acessos',
      );
    return {
      ...user,
      permissions,
      global: permissions.includes('ACCESS_ALL_DEPARTMENTS'),
    };
  }

  private async scopedProcess(
    id: string,
    actorId: string,
    permission: SystemPermission,
  ) {
    const actor = await this.actor(actorId, permission);
    const process = await this.prisma.lifecycleProcess.findFirst({
      where: {
        id,
        ...(!actor.global
          ? { targetDepartmentIds: { equals: [actor.departmentId] } }
          : {}),
      },
      include: processInclude,
    });
    if (!process)
      throw new NotFoundException(
        'Processo não encontrado no âmbito autorizado',
      );
    return { actor, process };
  }

  async configuration(actorId: string) {
    const actor = await this.actor(actorId, 'ACCESS_READ');
    const scope = actor.global
      ? {}
      : {
          OR: [
            { departmentIds: { isEmpty: true } },
            { departmentIds: { has: actor.departmentId } },
          ],
        };
    const [resources, policies, departments] = await Promise.all([
      // Coordinators may request any service for people in their own department.
      // Only policy defaults/people are scoped; private links remain redacted below.
      this.prisma.accessResource.findMany({
        orderBy: { name: 'asc' },
      }),
      this.prisma.accessPolicy.findMany({
        where: scope,
        orderBy: { name: 'asc' },
      }),
      this.prisma.department.findMany({
        where: actor.global ? {} : { id: actor.departmentId },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      }),
    ]);
    const formUrl = process.env.ACCESS_FORMS_URL;
    return {
      resources: protectAdminLinks(
        resources,
        actor.global && actor.permissions.includes('ACCESS_MANAGE'),
      ),
      policies,
      departments,
      permissions: actor.permissions,
      formUrl:
        formUrl &&
        /^https:\/\/(docs\.google\.com\/forms\/|forms\.gle\/)/.test(formUrl)
          ? formUrl
          : undefined,
      intakeConfigured: this.intake.configured,
      intakeSources: this.intake.sources,
      executorEnabled: process.env.ACCESS_EXECUTOR_ENABLED === 'true',
      dryRun: process.env.ACCESS_EXECUTOR_DRY_RUN !== 'false',
    };
  }

  async intakeResponses(actorId: string, query: LifecycleQueryDto) {
    const actor = await this.actor(actorId, 'ACCESS_CREATE');
    if (!query.query || query.query.trim().length < 3)
      throw new BadRequestException(
        'Pesquisar pelo menos três caracteres no Forms/Sheets',
      );
    const search = normalizeIntakeText(query.query).split(' ');
    return (await this.intake.responses(query.intakeSource))
      .filter(
        (row) =>
          row.departmentIds.length &&
          (actor.global ||
            row.departmentIds.every((id) => id === actor.departmentId)) &&
          search.every((term) =>
            normalizeIntakeText(`${row.name} ${row.email}`).includes(term),
          ),
      )
      .slice(query.offset, query.offset + 25);
  }

  async preview(actorId: string, dto: AccessPreviewDto) {
    const actor = await this.actor(actorId, 'ACCESS_CREATE');
    assertScope(actor.departmentId, actor.global, dto.departmentIds);
    const policies = await this.prisma.accessPolicy.findMany({
      where: { enabled: true },
    });
    const selected = policies.filter((policy) =>
      policyMatches(policy, dto.departmentIds, dto.positions),
    );
    const ids = [...new Set(selected.flatMap((policy) => policy.resourceIds))];
    const resources = await this.prisma.accessResource.findMany({
      where: { id: { in: ids }, enabled: true },
    });
    return {
      policies: selected.map((policy) => ({
        id: policy.id,
        name: policy.name,
        version: policy.version,
        departmentIds: policy.departmentIds,
        positions: policy.positions,
        resourceIds: policy.resourceIds,
      })),
      resources: protectAdminLinks(
        resources.filter(
          (resource) =>
            !resource.departmentIds.length ||
            resource.departmentIds.some((id) => dto.departmentIds.includes(id)),
        ),
        false,
      ),
    };
  }

  async create(actorId: string, dto: CreateLifecycleDto) {
    const actor = await this.actor(actorId, 'ACCESS_CREATE');
    assertScope(actor.departmentId, actor.global, dto.targetDepartmentIds);
    if (
      dto.kind === 'ALUMNI_TRANSITION' &&
      !dto.targetPositions.some((position) => position !== 'ALUMNI')
    )
      throw new BadRequestException(
        'Transição para Alumni exige pelo menos um cargo de origem',
      );
    const departmentCount = await this.prisma.department.count({
      where: { id: { in: dto.targetDepartmentIds } },
    });
    if (departmentCount !== dto.targetDepartmentIds.length)
      throw new BadRequestException('Departamento inválido');
    if (!dto.targetName.trim() || !dto.reason.trim())
      throw new BadRequestException('Nome e motivo obrigatórios');
    const preview = await this.preview(actorId, {
      departmentIds: dto.targetDepartmentIds,
      positions: dto.targetPositions,
    });
    const ids = dto.selectedOperations.map((op) => op.resourceId);
    if (new Set(ids).size !== ids.length)
      throw new BadRequestException(
        'Selecionar cada recurso uma única vez por processo',
      );
    const resources = await this.prisma.accessResource.findMany({
      where: { id: { in: ids }, enabled: true },
    });
    if (resources.length !== ids.length)
      throw new BadRequestException('Recurso desativado ou desconhecido');
    let source: Prisma.InputJsonValue;
    let declaredAccounts: Record<string, string> | undefined;
    let declaredSource: 'FORMS' | 'SHEETS' = 'SHEETS';
    if (dto.intakeSource && !dto.intakeKey)
      throw new BadRequestException('Selecionar um registo da origem indicada');
    if (dto.intakeKey) {
      const row = await this.intake.find(dto.intakeKey, dto.intakeSource);
      declaredAccounts = row.accounts;
      declaredSource = row.source || 'SHEETS';
      assertScope(actor.departmentId, actor.global, row.departmentIds);
      if (
        row.name !== dto.targetName ||
        row.email !== dto.targetEmail.toLowerCase()
      )
        throw new BadRequestException(
          'Identidade difere da resposta Forms/Sheets',
        );
      source = {
        type: declaredSource === 'FORMS' ? 'GOOGLE_FORMS' : 'GOOGLE_SHEETS',
        responseKey: row.key,
        importedAt: new Date().toISOString(),
      };
    } else {
      if (!dto.sourceNote?.trim())
        throw new BadRequestException(
          'Indicar origem dos dados quando não existe resposta Forms/Sheets',
        );
      source = { type: 'MANUAL', note: dto.sourceNote };
    }
    const identities = new Map<
      string,
      Promise<{ providerUserId: string | null }>
    >();
    const operations = await Promise.all(
      dto.selectedOperations.map(async (op) => {
        const resource = resources.find((value) => value.id === op.resourceId)!;
        // Out-of-department resources cannot be policy defaults (preview filters
        // them). They require a per-operation exception, frozen for independent
        // approval; this creates a draft and never executes the requested action.
        if (
          (resource.sensitive ||
            !preview.resources.some((value) => value.id === resource.id)) &&
          !op.exceptionReason?.trim()
        )
          throw new BadRequestException(
            'Recurso sensível ou exceção à política exige justificação explícita',
          );
        if (dto.kind === 'ONBOARD' && op.action === 'REVOKE')
          throw new BadRequestException('Onboarding não pode revogar acessos');
        if (dto.kind === 'OFFBOARD' && op.action === 'GRANT')
          throw new BadRequestException(
            'Concessões Alumni exigem ALUMNI_TRANSITION explícita',
          );
        if (
          resource.provider === 'GOOGLE_DRIVE' &&
          op.providerUserId?.includes('@') &&
          op.accountEmail &&
          op.providerUserId.trim().toLowerCase() !==
            op.accountEmail.trim().toLowerCase()
        )
          throw new BadRequestException(
            'Email Google difere da conta indicada',
          );
        if (
          op.accountUsername &&
          !['DISCORD', 'GITHUB'].includes(resource.provider)
        )
          throw new BadRequestException('Username apenas para Discord/GitHub');
        if (
          op.accountUsername !== undefined &&
          (!op.accountUsername.trim().replace(/^@/, '') || op.providerUserId)
        )
          throw new BadRequestException(
            'Indicar o username ou o ID legado, sem combinar ambos',
          );
        const principal = op.accountUsername
          ? `@${op.accountUsername.trim().replace(/^@/, '')}`
          : resource.provider === 'GOOGLE_DRIVE'
            ? op.providerUserId || op.accountEmail
            : op.providerUserId;
        assertOperationIdentity(op.action, principal);
        let providerUserId = principal?.trim();
        const resolveIdentity = (identity: string) => {
          const key = `${resource.provider}:${resource.containerId || ''}:${identity}`;
          if (!identities.has(key))
            identities.set(
              key,
              this.connectors
                .resolveIdentity({
                  provider: resource.provider,
                  providerUserId: identity,
                  accountEmail: op.accountEmail || null,
                  verificationNote: null,
                  resourceSnapshot: JSON.parse(
                    JSON.stringify(resource),
                  ) as Prisma.JsonValue,
                })
                .catch(throwProviderFailure),
            );
          return identities.get(key)!;
        };
        if (
          providerUserId &&
          resource.automatic &&
          ['DISCORD', 'GITHUB'].includes(resource.provider) &&
          resource.remoteId !== 'CONFIGURE_ME'
        ) {
          providerUserId =
            (await resolveIdentity(providerUserId)).providerUserId || undefined;
        }
        const fields =
          resource.provider === 'DISCORD'
            ? ['discordUsername', 'discordId']
            : resource.provider === 'GITHUB'
              ? ['githubUsername', 'githubId']
              : resource.provider === 'GOOGLE_DRIVE'
                ? ['googleEmail']
                : [];
        const declaredField = fields.find((field) =>
          declaredAccounts?.[field]?.trim(),
        );
        const declared = declaredField
          ? declaredAccounts![declaredField].trim()
          : undefined;
        const declaredPrincipal =
          declared && declaredField?.endsWith('Username')
            ? `@${declared.replace(/^@/, '')}`
            : declared;
        const normalizeAccount = (value: string) =>
          value.trim().replace(/^@/, '').toLowerCase();
        if (
          declaredPrincipal &&
          principal &&
          (normalizeAccount(
            resource.provider === 'GOOGLE_DRIVE'
              ? op.accountEmail || principal
              : principal,
          ) !== normalizeAccount(declaredPrincipal) ||
            (['DISCORD', 'GITHUB'].includes(resource.provider) &&
              /^\d+$/.test(principal) !== /^\d+$/.test(declaredPrincipal)))
        ) {
          let sameAccount = false;
          if (
            ['DISCORD', 'GITHUB'].includes(resource.provider) &&
            resource.automatic &&
            resource.remoteId !== 'CONFIGURE_ME'
          ) {
            const expected = (await resolveIdentity(declaredPrincipal))
              .providerUserId;
            sameAccount = Boolean(
              expected && /^\d+$/.test(expected) && expected === providerUserId,
            );
          }
          if (!sameAccount)
            throw new BadRequestException(
              'Conta externa difere da resposta Forms/Sheets da pessoa; atualizar a origem ou corrigir a conta',
            );
        }
        const accountName =
          op.accountUsername?.trim() ||
          (principal &&
          !(
            ['DISCORD', 'GITHUB'].includes(resource.provider) &&
            /^\d+$/.test(principal)
          )
            ? principal
            : undefined);
        return {
          action: op.action,
          provider: resource.provider,
          resourceSnapshot: JSON.parse(
            JSON.stringify(resource),
          ) as Prisma.InputJsonValue,
          providerUserId,
          accountEmail: op.accountEmail,
          verificationNote: op.verificationNote?.trim() || undefined,
          exceptionReason: op.exceptionReason,
          automatic: resource.automatic && resource.remoteId !== 'CONFIGURE_ME',
          ...(principal
            ? {
                result: {
                  ...(accountName ? { accountName } : {}),
                  ...(fields.length
                    ? { identitySource: declared ? declaredSource : 'OPERATOR' }
                    : {}),
                },
              }
            : {}),
        };
      }),
    );
    const result = await this.prisma.lifecycleProcess.create({
      data: {
        kind: dto.kind,
        targetName: dto.targetName.trim(),
        targetEmail: dto.targetEmail.toLowerCase(),
        targetDepartmentIds: dto.targetDepartmentIds,
        targetPositions: dto.targetPositions,
        reason: dto.reason,
        requestedByUserId: actorId,
        source,
        policySnapshot: {
          policies: preview.policies,
          defaultResourceIds: preview.resources.map((resource) => resource.id),
        },
        operations: { create: operations },
      },
      include: processInclude,
    });
    return protectAdminLinks(result, false);
  }

  async list(actorId: string, query: LifecycleQueryDto) {
    const actor = await this.actor(actorId, 'ACCESS_READ');
    if (
      query.providerUserId !== undefined &&
      query.providerUserId.trim().length < 3
    )
      throw new BadRequestException(
        'Pesquisar pelo menos três caracteres na conta externa',
      );
    const results = await this.prisma.lifecycleProcess.findMany({
      where: {
        ...(!actor.global
          ? { targetDepartmentIds: { equals: [actor.departmentId] } }
          : {}),
        ...(query.status ? { status: query.status } : {}),
        ...(query.query
          ? {
              OR: [
                { targetName: { contains: query.query, mode: 'insensitive' } },
                { targetEmail: { contains: query.query, mode: 'insensitive' } },
              ],
            }
          : {}),
        ...(query.provider || query.providerUserId
          ? {
              operations: {
                some: {
                  ...(query.provider ? { provider: query.provider } : {}),
                  ...(query.providerUserId
                    ? {
                        OR: [
                          {
                            providerUserId: {
                              contains: query.providerUserId,
                              mode: 'insensitive' as const,
                            },
                          },
                          {
                            accountEmail: {
                              contains: query.providerUserId,
                              mode: 'insensitive' as const,
                            },
                          },
                          {
                            result: {
                              path: ['accountName'],
                              string_contains: query.providerUserId,
                              mode: 'insensitive' as const,
                            },
                          },
                        ],
                      }
                    : {}),
                },
              },
            }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
      skip: query.offset,
      include: processInclude,
    });
    return results.map((process) =>
      protectAdminLinks(
        process,
        process.status === 'APPROVED' &&
          actor.permissions.includes('ACCESS_EXECUTE'),
      ),
    );
  }

  async get(actorId: string, id: string) {
    const { actor, process } = await this.scopedProcess(
      id,
      actorId,
      'ACCESS_READ',
    );
    return protectAdminLinks(
      process,
      process.status === 'APPROVED' &&
        actor.permissions.includes('ACCESS_EXECUTE'),
    );
  }

  async submit(actorId: string, id: string) {
    const { process } = await this.scopedProcess(id, actorId, 'ACCESS_CREATE');
    if (process.requestedByUserId !== actorId || process.status !== 'DRAFT')
      throw new ForbiddenException('Só o solicitante pode submeter o rascunho');
    this.assertSensitiveIdentities(process.operations);
    const changed = await this.prisma.lifecycleProcess.updateMany({
      where: { id, status: 'DRAFT', version: process.version },
      data: {
        status: 'PENDING_APPROVAL',
        submittedAt: new Date(),
        version: { increment: 1 },
      },
    });
    if (!changed.count)
      throw new ConflictException('Processo alterado; voltar a carregar');
    return this.get(actorId, id);
  }

  async decide(actorId: string, id: string, dto: LifecycleDecisionDto) {
    if (dto.note.trim().length < 5)
      throw new BadRequestException('Decisão exige justificação');
    const { process } = await this.scopedProcess(id, actorId, 'ACCESS_APPROVE');
    assertDecision(process.requestedByUserId, actorId, process.status);
    if (dto.approved) this.assertSensitiveIdentities(process.operations);
    await this.prisma.$transaction(async (tx) => {
      const changed = await tx.lifecycleProcess.updateMany({
        where: { id, status: 'PENDING_APPROVAL', version: process.version },
        data: {
          status: dto.approved ? 'APPROVED' : 'REJECTED',
          version: { increment: 1 },
        },
      });
      if (!changed.count) throw new ConflictException('Pedido já decidido');
      await tx.processApproval.create({
        data: {
          processId: id,
          decidedById: actorId,
          approved: dto.approved,
          note: dto.note,
          snapshot: JSON.parse(
            JSON.stringify(process),
          ) as Prisma.InputJsonValue,
        },
      });
      for (const op of process.operations) {
        await tx.accessOperation.update({
          where: { id: op.id },
          data: {
            status: !dto.approved
              ? 'CANCELLED'
              : !op.automatic
                ? 'AWAITING_MANUAL'
                : !op.providerUserId
                  ? 'AWAITING_ACCOUNT'
                  : 'PENDING',
          },
        });
      }
    });
    return this.get(actorId, id);
  }

  async confirm(
    actorId: string,
    id: string,
    operationId: string,
    dto: OperationEvidenceDto,
  ) {
    if (dto.note.trim().length < 5)
      throw new BadRequestException('Confirmação exige evidência');
    const { process } = await this.scopedProcess(id, actorId, 'ACCESS_EXECUTE');
    if (process.status !== 'APPROVED')
      throw new BadRequestException('Processo não está aprovado para execução');
    const op = process.operations.find((value) => value.id === operationId);
    if (
      !op ||
      !['AWAITING_MANUAL', 'AWAITING_ACCOUNT', 'FAILED'].includes(op.status)
    )
      throw new BadRequestException('Operação não aguarda confirmação');
    assertOperationIdentity(op.action, op.providerUserId);
    if (dto.outcome === 'AWAITING_ACCOUNT' && op.action === 'REVOKE')
      throw new BadRequestException('Convite pendente não confirma revogação');
    // Automatic results are verified by the provider, not marked successful by a client.
    if (op.automatic && op.status !== 'AWAITING_MANUAL')
      throw new BadRequestException(
        'Usar retry para verificar operação automática',
      );
    await this.prisma.$transaction(async (tx) => {
      const changed = await tx.accessOperation.updateMany({
        where: { id: op.id, status: op.status, updatedAt: op.updatedAt },
        data: {
          status: dto.outcome,
          lastError:
            dto.outcome === 'FAILED' ? 'MANUAL_EXECUTION_FAILED' : null,
        },
      });
      if (!changed.count)
        throw new ConflictException('Operação alterada; voltar a carregar');
      await tx.operationEvidence.create({
        data: {
          operationId,
          performedById: actorId,
          outcome: dto.outcome,
          note: dto.note,
        },
      });
      await this.completeIfReady(tx, id);
    });
    return this.get(actorId, id);
  }

  async retry(actorId: string, id: string, operationId: string) {
    const { process } = await this.scopedProcess(id, actorId, 'ACCESS_EXECUTE');
    const op = process.operations.find((value) => value.id === operationId);
    if (
      process.status !== 'APPROVED' ||
      !op ||
      !['FAILED', 'AWAITING_ACCOUNT', 'AWAITING_MANUAL'].includes(op.status) ||
      !op.automatic
    )
      throw new BadRequestException('Operação não pode ser repetida');
    if (op.attempts >= 8)
      throw new BadRequestException(
        'Limite de tentativas atingido; criar pedido revisto',
      );
    if (!op.providerUserId)
      throw new BadRequestException(
        'Criar pedido revisto com username ou email para nova aprovação',
      );
    const changed = await this.prisma.accessOperation.updateMany({
      where: { id: operationId, status: op.status, updatedAt: op.updatedAt },
      data: { status: 'PENDING', nextAttemptAt: new Date(), lastError: null },
    });
    if (!changed.count) throw new ConflictException('Operação já em execução');
    return this.get(actorId, id);
  }

  async cancel(actorId: string, id: string) {
    const { process } = await this.scopedProcess(id, actorId, 'ACCESS_CREATE');
    if (
      process.requestedByUserId !== actorId ||
      !['DRAFT', 'PENDING_APPROVAL'].includes(process.status)
    )
      throw new BadRequestException(
        'Só é possível cancelar pedido próprio antes da aprovação',
      );
    await this.prisma.$transaction(async (tx) => {
      const changed = await tx.lifecycleProcess.updateMany({
        where: { id, status: process.status, version: process.version },
        data: { status: 'CANCELLED', version: { increment: 1 } },
      });
      if (!changed.count) throw new ConflictException('Processo alterado');
      await tx.accessOperation.updateMany({
        where: { processId: id },
        data: { status: 'CANCELLED' },
      });
    });
    return this.get(actorId, id);
  }

  async completeIfReady(tx: Prisma.TransactionClient, processId: string) {
    // Serialize completion checks so parallel operations cannot leave a finished process open.
    await tx.$queryRaw`SELECT "id" FROM "LifecycleProcess" WHERE "id" = ${processId} FOR UPDATE`;
    const remaining = await tx.accessOperation.count({
      where: {
        processId,
        status: { notIn: ['SUCCEEDED', 'SKIPPED', 'CANCELLED'] },
      },
    });
    if (!remaining)
      await tx.lifecycleProcess.updateMany({
        where: { id: processId, status: 'APPROVED' },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          version: { increment: 1 },
        },
      });
  }

  private async manager(actorId: string) {
    const actor = await this.actor(actorId, 'ACCESS_MANAGE');
    if (!actor.global)
      throw new ForbiddenException(
        'Administração exige âmbito global explícito',
      );
  }

  async reconcile(actorId: string, id: string, operationId: string) {
    const { process } = await this.scopedProcess(id, actorId, 'ACCESS_EXECUTE');
    const op = process.operations.find((value) => value.id === operationId);
    if (!op?.automatic || !['APPROVED', 'COMPLETED'].includes(process.status))
      throw new BadRequestException(
        'Reconciliação exige operação automática aprovada',
      );
    const observed = await this.connectors.execute({ ...op, action: 'VERIFY' });
    await this.prisma.operationEvidence.create({
      data: {
        operationId,
        performedById: actorId,
        outcome: 'OBSERVED',
        note: observed.detail,
      },
    });
    return observed;
  }

  async inventory(actorId: string, id: string) {
    const { process } = await this.scopedProcess(id, actorId, 'ACCESS_READ');
    const result: {
      operationId: string;
      resource: string;
      observation?: { status: string; detail: string };
      discovered?: {
        remoteId: string;
        name: string;
        administrative: boolean;
      }[];
      partial: boolean;
      error?: string;
    }[] = [];
    // Read-only inventory is available before approval; it never queues mutations.
    for (const op of process.operations.filter((value) => value.automatic)) {
      try {
        result.push({
          operationId: op.id,
          resource: (op.resourceSnapshot as { name: string }).name,
          ...(await this.connectors.inventory(op)),
        });
      } catch {
        result.push({
          operationId: op.id,
          resource: (op.resourceSnapshot as { name: string }).name,
          partial: true,
          error: 'Não foi possível observar este recurso',
        });
      }
    }
    return result;
  }

  private assertSensitiveIdentities(
    operations: {
      provider: string;
      automatic: boolean;
      providerUserId: string | null;
      resourceSnapshot: Prisma.JsonValue;
    }[],
  ) {
    if (
      operations.some(
        (op) =>
          op.automatic &&
          ['DISCORD', 'GITHUB'].includes(op.provider) &&
          (op.resourceSnapshot as { sensitive?: boolean })?.sensitive &&
          !/^\d+$/.test(op.providerUserId || ''),
      )
    )
      throw new BadRequestException(
        'Recurso sensível exige conta identificada antes da aprovação; criar novo pedido após confirmar a conta/entrada no servidor',
      );
  }

  private async validateResource(
    dto: AccessResourceDto,
    validateRemote = true,
  ) {
    const types: Record<string, string[]> = {
      DISCORD: ['DISCORD_ROLE'],
      GITHUB: ['GITHUB_ORG', 'GITHUB_TEAM'],
      GOOGLE_DRIVE: ['DRIVE_FOLDER'],
      FIGMA: ['FIGMA_TEAM'],
      WHATSAPP: ['WHATSAPP_GROUP'],
      CODA: ['MANUAL'],
      FREEDCAMP: ['MANUAL'],
      EMAIL: ['MANUAL'],
    };
    if (!types[dto.provider].includes(dto.resourceType))
      throw new BadRequestException(
        'Tipo de recurso incompatível com plataforma',
      );
    if (
      dto.automatic &&
      !['DISCORD', 'GITHUB', 'GOOGLE_DRIVE'].includes(dto.provider)
    )
      throw new BadRequestException('Plataforma requer execução manual');
    if (
      dto.provider === 'DISCORD' &&
      /server.?manager/i.test(dto.name) &&
      !dto.sensitive
    )
      throw new BadRequestException('server-manager exige recurso sensível');
    if (
      dto.automatic &&
      dto.remoteId !== 'CONFIGURE_ME' &&
      (dto.provider === 'DISCORD' || dto.resourceType === 'GITHUB_TEAM') &&
      !dto.containerId
    )
      throw new BadRequestException('Servidor/organização obrigatórios');
    try {
      if (validateRemote) await this.connectors.validateDiscordResource(dto);
    } catch (error) {
      throwProviderFailure(error);
    }
  }

  async saveResource(
    actorId: string,
    dto: AccessResourceDto | UpdateAccessResourceDto,
    id?: string,
  ) {
    await this.manager(actorId);
    if (
      dto.departmentIds &&
      (await this.prisma.department.count({
        where: { id: { in: dto.departmentIds } },
      })) !== dto.departmentIds.length
    )
      throw new BadRequestException('Departamento inexistente no recurso');
    if (!id) {
      await this.validateResource(dto as AccessResourceDto);
      return this.prisma.accessResource.create({
        data: dto as AccessResourceDto,
      });
    }
    const existing = await this.prisma.accessResource.findUnique({
      where: { id },
    });
    if (!existing) throw new NotFoundException('Recurso não encontrado');
    const updated = { ...existing, ...dto } as AccessResourceDto;
    const validateRemote = (
      [
        'provider',
        'resourceType',
        'remoteId',
        'containerId',
        'sensitive',
        'automatic',
        'enabled',
      ] as const
    ).some((field) => updated[field] !== existing[field]);
    await this.validateResource(updated, validateRemote);
    const { version, ...data } = dto as UpdateAccessResourceDto;
    const result = await this.prisma.accessResource.updateMany({
      where: { id, version },
      data: { ...data, version: { increment: 1 } },
    });
    if (!result.count)
      throw new ConflictException('Versão do recurso alterada');
    return this.prisma.accessResource.findUnique({ where: { id } });
  }

  async savePolicy(
    actorId: string,
    dto: AccessPolicyDto | UpdateAccessPolicyDto,
    id?: string,
  ) {
    await this.manager(actorId);
    if (
      dto.departmentIds &&
      (await this.prisma.department.count({
        where: { id: { in: dto.departmentIds } },
      })) !== dto.departmentIds.length
    )
      throw new BadRequestException('Departamento inexistente na política');
    if (
      dto.resourceIds &&
      (await this.prisma.accessResource.count({
        where: { id: { in: dto.resourceIds } },
      })) !== dto.resourceIds.length
    )
      throw new BadRequestException('Política contém recursos inexistentes');
    if (!id)
      return this.prisma.accessPolicy.create({ data: dto as AccessPolicyDto });
    const { version, ...data } = dto as UpdateAccessPolicyDto;
    const result = await this.prisma.accessPolicy.updateMany({
      where: { id, version },
      data: { ...data, version: { increment: 1 } },
    });
    if (!result.count)
      throw new ConflictException('Política inexistente ou versão alterada');
    return this.prisma.accessPolicy.findUnique({ where: { id } });
  }
}
