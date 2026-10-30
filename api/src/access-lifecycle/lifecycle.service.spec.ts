import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { LifecycleService } from './lifecycle.service';
import { PrismaService } from '../prisma.service';
import { IntakeService } from './intake.service';
import { ConnectorsService } from './connectors.service';
import { env } from 'node:process';
import { ProviderError, ProviderHttp } from './provider-http';
import type { AccessOperation } from '@prisma/client';

describe('LifecycleService', () => {
  const prisma = {
    user: { findUnique: jest.fn() },
    department: { count: jest.fn(), findMany: jest.fn() },
    accessPolicy: { findMany: jest.fn() },
    accessResource: {
      findMany: jest.fn(),
      create: jest.fn(),
      updateMany: jest.fn(),
      findUnique: jest.fn(),
    },
    lifecycleProcess: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      updateMany: jest.fn(),
      create: jest.fn(),
    },
    accessOperation: {
      update: jest.fn(),
      updateMany: jest.fn(),
      count: jest.fn(),
    },
    processApproval: { create: jest.fn() },
    operationEvidence: { create: jest.fn() },
    $transaction: jest.fn(),
    $queryRaw: jest.fn(),
  };
  const intake = {
    sources: ['FORMS', 'SHEETS'],
    configured: true,
    responses: jest.fn(),
    find: jest.fn(),
  };
  const connectors = {
    resolveIdentity: jest.fn(),
    validateDiscordResource: jest.fn(),
  };
  const service = new LifecycleService(
    prisma as unknown as PrismaService,
    intake as unknown as IntakeService,
    connectors as unknown as ConnectorsService,
  );
  const createDto = () => ({
    kind: 'ONBOARD' as const,
    targetName: 'External person',
    targetEmail: 'external@example.com',
    targetDepartmentIds: ['it'],
    targetPositions: ['MEMBER'],
    reason: 'Onboarding access',
    sourceNote: 'Forms response checked manually',
    selectedOperations: [{ resourceId: 'resource', action: 'GRANT' as const }],
  });
  const actor = (
    permissions = [
      'ACCESS_READ',
      'ACCESS_CREATE',
      'ACCESS_APPROVE',
      'ACCESS_EXECUTE',
    ],
  ) => ({
    id: 'actor',
    status: 'ACTIVE',
    departmentId: 'it',
    userRoles: [{ role: { permissions } }],
  });
  const process = () => ({
    id: 'process',
    status: 'PENDING_APPROVAL',
    requestedByUserId: 'requester',
    targetDepartmentIds: ['it'],
    version: 2,
    operations: [
      {
        id: 'operation',
        automatic: true,
        providerUserId: '123',
        verificationNote: 'Provider checked',
        status: 'FAILED',
        attempts: 1,
        action: 'REVOKE',
      },
    ],
  });
  beforeEach(() => {
    jest.resetAllMocks();
    prisma.user.findUnique.mockResolvedValue(actor());
    prisma.lifecycleProcess.findFirst.mockResolvedValue(process());
    prisma.lifecycleProcess.findMany.mockResolvedValue([]);
    prisma.department.count.mockResolvedValue(1);
    prisma.accessPolicy.findMany.mockResolvedValue([
      {
        id: 'policy',
        name: 'Default',
        version: 1,
        enabled: true,
        departmentIds: ['it'],
        positions: [],
        resourceIds: ['resource'],
      },
    ]);
    prisma.accessResource.findMany.mockResolvedValue([
      {
        id: 'resource',
        provider: 'FIGMA',
        name: 'Team',
        remoteId: 'team',
        resourceType: 'FIGMA_TEAM',
        automatic: false,
        sensitive: false,
        departmentIds: [],
      },
    ]);
    prisma.lifecycleProcess.create.mockImplementation(
      ({ data }: { data: object }) => ({ ...data, id: 'new-process' }),
    );
    prisma.lifecycleProcess.updateMany.mockResolvedValue({ count: 1 });
    prisma.$transaction.mockImplementation(
      (callback: (tx: typeof prisma) => unknown) => callback(prisma),
    );
  });

  it('reports the effective executor mode without exposing environment credentials', async () => {
    const enabled = env.ACCESS_EXECUTOR_ENABLED;
    const dryRun = env.ACCESS_EXECUTOR_DRY_RUN;
    try {
      prisma.department.findMany.mockResolvedValue([]);
      delete env.ACCESS_EXECUTOR_ENABLED;
      delete env.ACCESS_EXECUTOR_DRY_RUN;
      expect(await service.configuration('actor')).toMatchObject({
        executorEnabled: false,
        dryRun: true,
        intakeSources: ['FORMS', 'SHEETS'],
      });
      env.ACCESS_EXECUTOR_ENABLED = 'true';
      env.ACCESS_EXECUTOR_DRY_RUN = 'false';
      expect(await service.configuration('actor')).toMatchObject({
        executorEnabled: true,
        dryRun: false,
      });
    } finally {
      if (enabled === undefined) delete env.ACCESS_EXECUTOR_ENABLED;
      else env.ACCESS_EXECUTOR_ENABLED = enabled;
      if (dryRun === undefined) delete env.ACCESS_EXECUTOR_DRY_RUN;
      else env.ACCESS_EXECUTOR_DRY_RUN = dryRun;
    }
  });

  it('returns the full resource catalogue to coordinators while keeping department and administrative-link scope', async () => {
    prisma.department.findMany.mockResolvedValue([{ id: 'it', name: 'IT' }]);
    prisma.accessResource.findMany.mockResolvedValue([
      {
        id: 'tool',
        departmentIds: ['external'],
        adminUrl: 'https://private.example/team',
      },
    ]);
    const config = await service.configuration('actor');
    expect(config.resources).toMatchObject([{ id: 'tool', adminUrl: null }]);
    expect(prisma.accessResource.findMany).toHaveBeenCalledWith({
      orderBy: { name: 'asc' },
    });
    expect(prisma.department.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'it' } }),
    );
  });

  it.each([
    [['ACCESS_READ', 'ACCESS_MANAGE'], false],
    [['ACCESS_READ', 'ACCESS_ALL_DEPARTMENTS'], false],
    [['ACCESS_READ', 'ACCESS_MANAGE', 'ACCESS_ALL_DEPARTMENTS'], true],
  ] as const)(
    'exposes catalogue management links only to global managers: %s',
    async (permissions, visible) => {
      prisma.user.findUnique.mockResolvedValue(actor([...permissions]));
      prisma.department.findMany.mockResolvedValue([]);
      prisma.accessResource.findMany.mockResolvedValue([
        {
          id: 'tool',
          departmentIds: ['external'],
          adminUrl: 'https://private.example/team',
        },
      ]);
      const config = await service.configuration('actor');
      expect(config.resources).toMatchObject([
        {
          id: 'tool',
          adminUrl: visible ? 'https://private.example/team' : null,
        },
      ]);
    },
  );

  it.each([
    'CODA',
    'FREEDCAMP',
    'DISCORD',
    'GITHUB',
    'GOOGLE_DRIVE',
    'FIGMA',
    'WHATSAPP',
    'EMAIL',
  ])(
    'allows an own-department person to receive a justified %s resource normally used elsewhere',
    async (provider) => {
      prisma.accessPolicy.findMany.mockResolvedValue([
        {
          id: 'external-policy',
          name: 'RE defaults',
          version: 1,
          enabled: true,
          departmentIds: ['external'],
          positions: ['MEMBER'],
          resourceIds: ['resource'],
        },
      ]);
      prisma.accessResource.findMany.mockImplementation(
        ({ where }: { where: { id?: { in: string[] } } }) =>
          Promise.resolve(
            where.id?.in.length === 0
              ? []
              : [
                  {
                    id: 'resource',
                    provider,
                    name: 'Coda',
                    remoteId: 'CONFIGURE_ME',
                    automatic: false,
                    sensitive: false,
                    departmentIds: ['external'],
                  },
                ],
          ),
      );
      const dto = {
        ...createDto(),
        selectedOperations: [
          {
            resourceId: 'resource',
            action: 'GRANT' as const,
            providerUserId: 'person@example.com',
            accountEmail: 'person@example.com',
            exceptionReason: 'Approved cross-tool collaboration',
          },
        ],
      };
      const result = await service.create('actor', dto);
      expect(result.targetDepartmentIds).toEqual(['it']);
      expect(result.policySnapshot).toMatchObject({ defaultResourceIds: [] });
      expect(result.operations).toMatchObject({
        create: [
          {
            provider,
            automatic: false,
            exceptionReason: 'Approved cross-tool collaboration',
          },
        ],
      });
      await expect(
        service.create('actor', {
          ...dto,
          selectedOperations: [
            { ...dto.selectedOperations[0], exceptionReason: undefined },
          ],
        }),
      ).rejects.toThrow('justificação');
    },
  );

  it('resolves a username before freezing the draft without requiring a client verification claim', async () => {
    prisma.accessResource.findMany.mockResolvedValue([
      {
        id: 'resource',
        provider: 'GITHUB',
        name: 'GitHub',
        remoteId: 'test-org',
        automatic: true,
        sensitive: false,
        departmentIds: [],
      },
    ]);
    connectors.resolveIdentity.mockResolvedValue({ providerUserId: '123' });
    const result = await service.create('actor', {
      ...createDto(),
      selectedOperations: [
        { resourceId: 'resource', action: 'GRANT', providerUserId: 'person' },
      ],
    });
    expect(result.operations).toMatchObject({
      create: [
        {
          providerUserId: '123',
          automatic: true,
          result: { accountName: 'person', identitySource: 'OPERATOR' },
        },
      ],
    });
    expect(connectors.resolveIdentity).toHaveBeenCalledTimes(1);
  });

  it('queues an automatic request without a human verification note', async () => {
    prisma.lifecycleProcess.findFirst.mockResolvedValue({
      ...process(),
      operations: [{ ...process().operations[0], verificationNote: null }],
    });
    await service.decide('actor', 'process', {
      approved: true,
      note: 'Reviewed account and access scope',
    });
    expect(prisma.accessOperation.update).toHaveBeenCalledWith({
      where: { id: 'operation' },
      data: { status: 'PENDING' },
    });
  });

  it('does not let a coordinator approve a justified cross-department exception', async () => {
    prisma.user.findUnique.mockResolvedValue(
      actor(['ACCESS_READ', 'ACCESS_CREATE', 'ACCESS_EXECUTE']),
    );
    await expect(
      service.decide('actor', 'process', {
        approved: true,
        note: 'Justified use of a resource from another department',
      }),
    ).rejects.toThrow(ForbiddenException);
    expect(prisma.processApproval.create).not.toHaveBeenCalled();
    expect(prisma.accessOperation.update).not.toHaveBeenCalled();
  });

  it('closes an approved unresolved Discord revocation with attributed manual evidence instead of a retry loop', async () => {
    const token = env.ACCESS_DISCORD_BOT_TOKEN;
    env.ACCESS_DISCORD_BOT_TOKEN = 'test';
    try {
      const provider = new ConnectorsService({
        request: jest.fn().mockResolvedValue([]),
      } as unknown as ProviderHttp);
      const outcome = await provider.execute({
        provider: 'DISCORD',
        action: 'REVOKE',
        providerUserId: '@departed.person',
        resourceSnapshot: {
          remoteId: '223456789012345678',
          containerId: '323456789012345678',
        },
      } as unknown as AccessOperation);
      expect(outcome.status).toBe('AWAITING_MANUAL');
      prisma.lifecycleProcess.findFirst.mockResolvedValue({
        ...process(),
        status: 'APPROVED',
        operations: [
          {
            ...process().operations[0],
            status: outcome.status,
            providerUserId: '@departed.person',
            updatedAt: new Date(),
          },
        ],
      });
      prisma.accessOperation.updateMany.mockResolvedValue({ count: 1 });
      prisma.accessOperation.count.mockResolvedValue(0);
      await service.confirm('actor', 'process', 'operation', {
        outcome: 'SUCCEEDED',
        note: 'Approved account and absence of guild membership checked manually',
      });
      expect(prisma.operationEvidence.create).toHaveBeenCalledWith({
        data: {
          operationId: 'operation',
          performedById: 'actor',
          outcome: 'SUCCEEDED',
          note: 'Approved account and absence of guild membership checked manually',
        },
      });
      const [[completed]] = prisma.lifecycleProcess.updateMany.mock.calls as [
        { data: { status: string } },
      ][];
      expect(completed.data.status).toBe('COMPLETED');
    } finally {
      if (token === undefined) delete env.ACCESS_DISCORD_BOT_TOKEN;
      else env.ACCESS_DISCORD_BOT_TOKEN = token;
    }
  });

  it.each([
    ['DISCORD_INVALID_USERNAME', false, BadRequestException],
    ['DISCORD_AMBIGUOUS_USERNAME', false, BadRequestException],
    ['GITHUB_INVALID_USERNAME', false, BadRequestException],
    ['GITHUB_ACCOUNT_MISMATCH', false, BadRequestException],
    ['DISCORD_NOT_CONFIGURED', false, ServiceUnavailableException],
    ['PROVIDER_HTTP_429', true, ServiceUnavailableException],
  ] as const)(
    'maps identity lookup %s to a controlled HTTP failure',
    async (code, retryable, exception) => {
      prisma.accessResource.findMany.mockResolvedValue([
        {
          id: 'resource',
          provider: 'GITHUB',
          remoteId: 'org',
          automatic: true,
          sensitive: false,
          departmentIds: [],
        },
      ]);
      connectors.resolveIdentity.mockRejectedValue(
        new ProviderError(code, retryable),
      );
      await expect(
        service.create('actor', {
          ...createDto(),
          selectedOperations: [
            {
              resourceId: 'resource',
              action: 'GRANT',
              accountUsername: 'person',
            },
          ],
        }),
      ).rejects.toThrow(exception);
      expect(prisma.lifecycleProcess.create).not.toHaveBeenCalled();
    },
  );

  it('rejects revoking an account that differs from the selected person in Sheets', async () => {
    prisma.accessResource.findMany.mockResolvedValue([
      {
        id: 'resource',
        provider: 'GITHUB',
        remoteId: 'org',
        automatic: true,
        sensitive: false,
        departmentIds: [],
      },
    ]);
    intake.find.mockResolvedValue({
      name: 'External person',
      email: 'external@example.com',
      departmentIds: ['it'],
      accounts: { githubUsername: 'person' },
    });
    connectors.resolveIdentity.mockImplementation(
      ({ providerUserId }: { providerUserId: string }) =>
        Promise.resolve({
          providerUserId: providerUserId === '@person' ? '123' : '999',
        }),
    );
    await expect(
      service.create('actor', {
        ...createDto(),
        kind: 'OFFBOARD',
        intakeKey: 'a'.repeat(64),
        selectedOperations: [
          {
            resourceId: 'resource',
            action: 'REVOKE',
            accountUsername: 'different-person',
          },
        ],
      }),
    ).rejects.toThrow('Sheets');
    expect(prisma.lifecycleProcess.create).not.toHaveBeenCalled();
  });

  it('accepts a username matching the legacy account ID declared in Sheets', async () => {
    prisma.accessResource.findMany.mockResolvedValue([
      {
        id: 'resource',
        provider: 'GITHUB',
        remoteId: 'org',
        automatic: true,
        sensitive: false,
        departmentIds: [],
      },
    ]);
    intake.find.mockResolvedValue({
      name: 'External person',
      email: 'external@example.com',
      departmentIds: ['it'],
      accounts: { githubId: '123' },
    });
    connectors.resolveIdentity.mockResolvedValue({ providerUserId: '123' });
    const result = await service.create('actor', {
      ...createDto(),
      intakeKey: 'a'.repeat(64),
      selectedOperations: [
        { resourceId: 'resource', action: 'GRANT', accountUsername: 'person' },
      ],
    });
    expect(result.operations).toMatchObject({
      create: [{ providerUserId: '123', result: { identitySource: 'SHEETS' } }],
    });
  });

  it('rejects a Google email different from the selected Sheets account', async () => {
    prisma.accessResource.findMany.mockResolvedValue([
      {
        id: 'resource',
        provider: 'GOOGLE_DRIVE',
        remoteId: 'folder',
        automatic: true,
        sensitive: false,
        departmentIds: [],
      },
    ]);
    intake.find.mockResolvedValue({
      name: 'External person',
      email: 'external@example.com',
      departmentIds: ['it'],
      accounts: { googleEmail: 'person@example.com' },
    });
    await expect(
      service.create('actor', {
        ...createDto(),
        intakeKey: 'a'.repeat(64),
        selectedOperations: [
          {
            resourceId: 'resource',
            action: 'GRANT',
            accountEmail: 'different@example.com',
          },
        ],
      }),
    ).rejects.toThrow('Sheets');
    expect(prisma.lifecycleProcess.create).not.toHaveBeenCalled();
  });

  it.each([
    [{ githubId: '123' }, { accountUsername: '123' }],
    [{ githubUsername: '123' }, { providerUserId: '123' }],
  ])(
    'distinguishes numeric usernames from legacy IDs when binding to Sheets %j',
    async (accounts, identity) => {
      prisma.accessResource.findMany.mockResolvedValue([
        {
          id: 'resource',
          provider: 'GITHUB',
          remoteId: 'org',
          automatic: true,
          sensitive: false,
          departmentIds: [],
        },
      ]);
      intake.find.mockResolvedValue({
        name: 'External person',
        email: 'external@example.com',
        departmentIds: ['it'],
        accounts,
      });
      connectors.resolveIdentity.mockImplementation(
        ({ providerUserId }: { providerUserId: string }) =>
          Promise.resolve({
            providerUserId: providerUserId === '@123' ? '999' : '123',
          }),
      );
      await expect(
        service.create('actor', {
          ...createDto(),
          intakeKey: 'a'.repeat(64),
          selectedOperations: [
            { resourceId: 'resource', action: 'GRANT', ...identity },
          ],
        }),
      ).rejects.toThrow('Sheets');
      expect(prisma.lifecycleProcess.create).not.toHaveBeenCalled();
    },
  );

  it.each(
    ['GRANT', 'REVOKE'].flatMap((action) =>
      ['legacy-first', 'username-first'].flatMap((order) =>
        ['person.name', ''].map((username) => ({
          action: action as 'GRANT' | 'REVOKE',
          order,
          username,
        })),
      ),
    ),
  )(
    'rejects $action for a numeric Discord username colliding with a legacy ID ($order, declared username $username)',
    async ({ action, order, username }) => {
      const settings = [
        'ACCESS_SHEETS_ID',
        'ACCESS_SHEETS_RANGE',
        'ACCESS_SHEETS_COLUMNS',
        'ACCESS_SHEETS_DEPARTMENTS',
      ];
      const saved = settings.map((key) => [key, env[key]] as const);
      try {
        env.ACCESS_SHEETS_ID = 'configured-sheet';
        env.ACCESS_SHEETS_RANGE = 'Membros!A1:Z500';
        env.ACCESS_SHEETS_DEPARTMENTS = '{}';
        delete env.ACCESS_SHEETS_COLUMNS;
        const legacyId = '123456789012345678';
        const accountHeaders =
          order === 'legacy-first'
            ? ['ID Discord', 'Username Discord']
            : ['Username Discord', 'ID Discord'];
        const values =
          order === 'legacy-first'
            ? [legacyId, username]
            : [username, legacyId];
        const http = {
          google: jest.fn().mockResolvedValue('Bearer test'),
          request: jest.fn().mockResolvedValue({
            values: [
              ['Nome', 'Email', 'Departamento', ...accountHeaders],
              ['External person', 'external@example.com', 'it', ...values],
            ],
          }),
        };
        const actualIntake = new IntakeService(http as unknown as ProviderHttp);
        const [row] = await actualIntake.responses('SHEETS');
        intake.find.mockResolvedValue(row);
        prisma.accessResource.findMany.mockResolvedValue([
          {
            id: 'resource',
            provider: 'DISCORD',
            remoteId: 'role',
            containerId: 'guild',
            automatic: true,
            sensitive: false,
            departmentIds: [],
          },
        ]);
        connectors.resolveIdentity.mockImplementation(
          ({ providerUserId }: { providerUserId: string }) =>
            Promise.resolve({
              providerUserId:
                providerUserId === `@${legacyId}`
                  ? '999999999999999999'
                  : legacyId,
            }),
        );
        await expect(
          service.create('actor', {
            ...createDto(),
            kind: action === 'GRANT' ? 'ONBOARD' : 'OFFBOARD',
            intakeSource: 'SHEETS',
            intakeKey: row.key,
            selectedOperations: [
              { resourceId: 'resource', action, accountUsername: legacyId },
            ],
          }),
        ).rejects.toThrow(BadRequestException);
        expect(prisma.lifecycleProcess.create).not.toHaveBeenCalled();
        const correctIdentity = username
          ? { accountUsername: username }
          : { providerUserId: legacyId };
        const result = await service.create('actor', {
          ...createDto(),
          kind: action === 'GRANT' ? 'ONBOARD' : 'OFFBOARD',
          intakeSource: 'SHEETS',
          intakeKey: row.key,
          selectedOperations: [
            { resourceId: 'resource', action, ...correctIdentity },
          ],
        });
        expect(result.operations).toMatchObject({
          create: [{ providerUserId: legacyId }],
        });
      } finally {
        for (const [key, value] of saved) {
          if (value === undefined) delete env[key];
          else env[key] = value;
        }
      }
    },
  );

  it.each([
    ['DISCORD_PROTECTED_ROLE', BadRequestException],
    ['DISCORD_NOT_CONFIGURED', ServiceUnavailableException],
  ] as const)(
    'rejects invalid resource configuration with a controlled %s response',
    async (code, exception) => {
      prisma.user.findUnique.mockResolvedValue(
        actor(['ACCESS_READ', 'ACCESS_MANAGE', 'ACCESS_ALL_DEPARTMENTS']),
      );
      prisma.department.count.mockResolvedValue(0);
      connectors.validateDiscordResource.mockRejectedValue(
        new ProviderError(code),
      );
      await expect(
        service.saveResource('actor', {
          provider: 'DISCORD',
          name: 'Privileged',
          remoteId: 'role',
          containerId: 'guild',
          resourceType: 'DISCORD_ROLE',
          automatic: true,
          sensitive: false,
          enabled: true,
          departmentIds: [],
          instructions: '',
        }),
      ).rejects.toThrow(exception);
      expect(prisma.accessResource.create).not.toHaveBeenCalled();
    },
  );

  it.each(['DISCORD', 'GITHUB'])(
    'blocks approval of unresolved sensitive %s identities at submit and decision',
    async (provider) => {
      const pending = {
        ...process(),
        operations: [
          {
            ...process().operations[0],
            provider,
            providerUserId: '@person',
            resourceSnapshot: { sensitive: true },
          },
        ],
      };
      prisma.lifecycleProcess.findFirst.mockResolvedValue({
        ...pending,
        status: 'DRAFT',
        requestedByUserId: 'actor',
      });
      await expect(service.submit('actor', 'process')).rejects.toThrow(
        'identificada',
      );
      expect(prisma.lifecycleProcess.updateMany).not.toHaveBeenCalled();
      prisma.lifecycleProcess.findFirst.mockResolvedValue(pending);
      await expect(
        service.decide('actor', 'process', {
          approved: true,
          note: 'Reviewed independently',
        }),
      ).rejects.toThrow('identificada');
      expect(prisma.processApproval.create).not.toHaveBeenCalled();
      await expect(
        service.decide('actor', 'process', {
          approved: false,
          note: 'Identity unresolved, reject request',
        }),
      ).resolves.toBeDefined();
    },
  );

  it('does not block descriptive resource edits on a Discord outage', async () => {
    prisma.user.findUnique.mockResolvedValue(
      actor(['ACCESS_READ', 'ACCESS_MANAGE', 'ACCESS_ALL_DEPARTMENTS']),
    );
    prisma.accessResource.findUnique.mockResolvedValue({
      provider: 'DISCORD',
      name: 'Role',
      remoteId: 'role',
      containerId: 'guild',
      resourceType: 'DISCORD_ROLE',
      automatic: true,
      sensitive: true,
      enabled: true,
      departmentIds: [],
      version: 2,
    });
    prisma.accessResource.updateMany.mockResolvedValue({ count: 1 });
    connectors.validateDiscordResource.mockRejectedValue(
      new ProviderError('DISCORD_NOT_CONFIGURED'),
    );
    await service.saveResource(
      'actor',
      { name: 'Renamed role', instructions: 'New instructions', version: 2 },
      'resource',
    );
    expect(connectors.validateDiscordResource).not.toHaveBeenCalled();
    expect(prisma.accessResource.updateMany).toHaveBeenCalled();
    await expect(
      service.saveResource(
        'actor',
        { sensitive: false, version: 2 },
        'resource',
      ),
    ).rejects.toThrow(ServiceUnavailableException);
  });

  it.each(['a', 'ab', '   '])(
    'rejects a broad remote-account filter %j before the SQL scan',
    async (providerUserId) => {
      await expect(
        service.list('actor', { providerUserId, offset: 0 }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.lifecycleProcess.findMany).not.toHaveBeenCalled();
    },
  );

  it('distinguishes an explicit numeric username from a legacy account ID before approval', async () => {
    prisma.accessResource.findMany.mockResolvedValue([
      {
        id: 'resource',
        provider: 'GITHUB',
        name: 'GitHub',
        remoteId: 'test-org',
        automatic: true,
        sensitive: false,
        departmentIds: [],
      },
    ]);
    connectors.resolveIdentity.mockResolvedValue({ providerUserId: '456' });
    const result = await service.create('actor', {
      ...createDto(),
      selectedOperations: [
        { resourceId: 'resource', action: 'GRANT', accountUsername: '123' },
      ],
    });
    expect(connectors.resolveIdentity).toHaveBeenCalledWith(
      expect.objectContaining({ providerUserId: '@123' }),
    );
    expect(result.operations).toMatchObject({
      create: [{ providerUserId: '456', result: { accountName: '123' } }],
    });
  });

  it('keeps an unconfigured Presidency Drive step manual without hiding it', async () => {
    prisma.accessResource.findMany.mockResolvedValue([
      {
        id: 'resource',
        provider: 'GOOGLE_DRIVE',
        name: 'Drive Presidency',
        remoteId: 'CONFIGURE_ME',
        automatic: true,
        sensitive: true,
        departmentIds: [],
        instructions:
          'A Presidency operator shares the folder and records evidence',
      },
    ]);
    const result = await service.create('actor', {
      ...createDto(),
      selectedOperations: [
        {
          resourceId: 'resource',
          action: 'GRANT',
          accountEmail: 'person@example.com',
          exceptionReason: 'Presidency approved temporary collaboration',
        },
      ],
    });
    expect(result.operations).toMatchObject({
      create: [
        {
          providerUserId: 'person@example.com',
          automatic: false,
          resourceSnapshot: {
            instructions:
              'A Presidency operator shares the folder and records evidence',
          },
        },
      ],
    });
  });

  it('rejects a Google email that differs from the submitted principal', async () => {
    prisma.accessResource.findMany.mockResolvedValue([
      {
        id: 'resource',
        provider: 'GOOGLE_DRIVE',
        remoteId: 'folder',
        automatic: true,
        sensitive: false,
        departmentIds: [],
      },
    ]);
    await expect(
      service.create('actor', {
        ...createDto(),
        selectedOperations: [
          {
            resourceId: 'resource',
            action: 'GRANT',
            providerUserId: 'one@example.com',
            accountEmail: 'other@example.com',
          },
        ],
      }),
    ).rejects.toThrow('Email Google difere');
    expect(prisma.lifecycleProcess.create).not.toHaveBeenCalled();
  });

  it('searches accents and separated name terms within the live department scope', async () => {
    intake.responses.mockResolvedValue([
      {
        name: 'José da Silva',
        email: 'person@example.com',
        departmentIds: ['it'],
      },
      {
        name: 'José da Silva',
        email: 'other@example.com',
        departmentIds: ['external'],
      },
    ]);
    expect(
      await service.intakeResponses('actor', {
        query: '  jose silva ',
        offset: 0,
      }),
    ).toHaveLength(1);
  });

  it('uses live permissions and rejects suspended operators', async () => {
    prisma.user.findUnique.mockResolvedValue({
      ...actor(),
      status: 'SUSPENDED',
    });
    await expect(service.list('actor', { offset: 0 })).rejects.toThrow(
      ForbiddenException,
    );
    expect(prisma.lifecycleProcess.findMany).not.toHaveBeenCalled();
  });

  it.each(['FORMS', 'SHEETS'] as const)(
    'keeps department scope when searching the selected %s origin',
    async (intakeSource) => {
      intake.responses.mockResolvedValue([
        { name: 'Pessoa', email: 'person@example.com', departmentIds: ['it'] },
        {
          name: 'Pessoa',
          email: 'other@example.com',
          departmentIds: ['external'],
        },
      ]);
      expect(
        await service.intakeResponses('actor', {
          query: 'Pessoa',
          offset: 0,
          intakeSource,
        }),
      ).toHaveLength(1);
      expect(intake.responses).toHaveBeenCalledWith(intakeSource);
    },
  );

  it.each([
    ['FORMS', 'ONBOARD', 'GRANT'],
    ['FORMS', 'OFFBOARD', 'REVOKE'],
    ['SHEETS', 'ONBOARD', 'GRANT'],
    ['SHEETS', 'OFFBOARD', 'REVOKE'],
  ] as const)(
    'records %s provenance for %s processes',
    async (intakeSource, kind, action) => {
      prisma.accessResource.findMany.mockResolvedValue([
        {
          id: 'resource',
          provider: 'GITHUB',
          remoteId: 'org',
          automatic: true,
          sensitive: false,
          departmentIds: [],
        },
      ]);
      intake.find.mockResolvedValue({
        source: intakeSource,
        name: 'External person',
        email: 'external@example.com',
        departmentIds: ['it'],
        accounts: { githubUsername: 'person' },
      });
      connectors.resolveIdentity.mockResolvedValue({ providerUserId: '123' });
      const result = await service.create('actor', {
        ...createDto(),
        kind,
        intakeSource,
        intakeKey: 'a'.repeat(64),
        selectedOperations: [
          { resourceId: 'resource', action, accountUsername: 'person' },
        ],
      });
      expect(intake.find).toHaveBeenCalledWith('a'.repeat(64), intakeSource);
      expect(result.source).toMatchObject({
        type: intakeSource === 'FORMS' ? 'GOOGLE_FORMS' : 'GOOGLE_SHEETS',
      });
      expect(result.operations).toMatchObject({
        create: [{ result: { identitySource: intakeSource } }],
      });
    },
  );

  it('rejects a selected origin without an intake record', async () => {
    await expect(
      service.create('actor', { ...createDto(), intakeSource: 'FORMS' }),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.lifecycleProcess.create).not.toHaveBeenCalled();
  });

  it('refuses cross-department creation before accessing resources', async () => {
    await expect(
      service.create('actor', {
        ...createDto(),
        targetDepartmentIds: ['it', 'marketing'],
      }),
    ).rejects.toThrow(ForbiddenException);
    expect(prisma.accessResource.findMany).not.toHaveBeenCalled();
    expect(prisma.lifecycleProcess.create).not.toHaveBeenCalled();
  });

  it('rejects a sensitive grant without a specific approved exception', async () => {
    prisma.accessResource.findMany.mockResolvedValue([
      {
        id: 'resource',
        provider: 'FIGMA',
        name: 'Team',
        sensitive: true,
        departmentIds: [],
      },
    ]);
    await expect(service.create('actor', createDto())).rejects.toThrow(
      'justificação explícita',
    );
    expect(prisma.lifecycleProcess.create).not.toHaveBeenCalled();
  });

  it('rejects grants in offboarding and revocations without an account', async () => {
    await expect(
      service.create('actor', { ...createDto(), kind: 'OFFBOARD' }),
    ).rejects.toThrow('ALUMNI_TRANSITION');
    await expect(
      service.create('actor', {
        ...createDto(),
        kind: 'OFFBOARD',
        selectedOperations: [{ resourceId: 'resource', action: 'REVOKE' }],
      }),
    ).rejects.toThrow('ID remoto');
  });

  it.each([
    ['ONBOARD', 'GRANT'],
    ['OFFBOARD', 'REVOKE'],
  ] as const)(
    'supports a partial department change with %s without adding unselected operations',
    async (kind, action) => {
      const resources = ['resource', 'unselected'].map((id) => ({
        id,
        provider: 'FIGMA',
        name: id,
        remoteId: 'team',
        resourceType: 'FIGMA_TEAM',
        automatic: false,
        sensitive: false,
        departmentIds: [],
      }));
      prisma.accessPolicy.findMany.mockResolvedValue([
        {
          enabled: true,
          departmentIds: ['it'],
          positions: ['MEMBER'],
          resourceIds: ['resource', 'unselected'],
        },
      ]);
      prisma.accessResource.findMany.mockImplementation(
        ({ where }: { where: { id: { in: string[] } } }) =>
          Promise.resolve(
            resources.filter((resource) => where.id.in.includes(resource.id)),
          ),
      );
      await service.create('actor', {
        ...createDto(),
        kind,
        selectedOperations: [
          {
            resourceId: 'resource',
            action,
            providerUserId: 'person@example.com',
          },
        ],
      });
      const [[saved]] = prisma.lifecycleProcess.create.mock.calls as [
        {
          data: {
            kind: string;
            operations: {
              create: { action: string; resourceSnapshot: { id: string } }[];
            };
          };
        },
      ][];
      expect(saved.data.kind).toBe(kind);
      expect(
        saved.data.operations.create.map((operation) => ({
          action: operation.action,
          resourceId: operation.resourceSnapshot.id,
        })),
      ).toEqual([{ action, resourceId: 'resource' }]);
    },
  );

  it('allows approved Alumni retention of GitHub and Drive alongside removal of an old department role', async () => {
    const resources = [
      {
        id: 'github',
        provider: 'GITHUB',
        remoteId: 'org',
        resourceType: 'GITHUB_ORG',
      },
      {
        id: 'drive',
        provider: 'GOOGLE_DRIVE',
        remoteId: 'folder',
        resourceType: 'DRIVE_FOLDER',
      },
      {
        id: 'old-department',
        provider: 'DISCORD',
        remoteId: 'role',
        resourceType: 'DISCORD_ROLE',
        containerId: 'guild',
      },
    ].map((resource) => ({
      ...resource,
      name: resource.id,
      automatic: true,
      sensitive: false,
      departmentIds: [],
    }));
    prisma.accessResource.findMany.mockImplementation(
      ({ where }: { where: { id: { in: string[] } } }) =>
        Promise.resolve(
          resources.filter((resource) => where.id.in.includes(resource.id)),
        ),
    );
    connectors.resolveIdentity.mockResolvedValue({
      providerUserId: '123456789012345678',
    });
    await service.create('actor', {
      ...createDto(),
      kind: 'ALUMNI_TRANSITION',
      targetPositions: ['MEMBER', 'ALUMNI'],
      selectedOperations: [
        {
          resourceId: 'github',
          action: 'GRANT',
          accountUsername: 'person',
          exceptionReason: 'Continued contribution to approved projects',
        },
        {
          resourceId: 'drive',
          action: 'GRANT',
          accountEmail: 'person@example.com',
          exceptionReason: 'Continued access to approved documents',
        },
        {
          resourceId: 'old-department',
          action: 'REVOKE',
          accountUsername: 'person',
          exceptionReason: 'The previous department access ends',
        },
      ],
    });
    const [[saved]] = prisma.lifecycleProcess.create.mock.calls as [
      {
        data: {
          kind: string;
          operations: { create: { provider: string; action: string }[] };
        };
      },
    ][];
    expect(saved.data.kind).toBe('ALUMNI_TRANSITION');
    expect(
      saved.data.operations.create.map(({ provider, action }) => ({
        provider,
        action,
      })),
    ).toEqual([
      { provider: 'GITHUB', action: 'GRANT' },
      { provider: 'GOOGLE_DRIVE', action: 'GRANT' },
      { provider: 'DISCORD', action: 'REVOKE' },
    ]);
  });

  it.each([{ positions: [] }, { positions: ['ALUMNI'] }])(
    'rejects an Alumni transition without an origin position: $positions',
    async ({ positions }) => {
      await expect(
        service.create('actor', {
          ...createDto(),
          kind: 'ALUMNI_TRANSITION',
          targetPositions: positions,
        }),
      ).rejects.toThrow('cargo de origem');
      expect(prisma.lifecycleProcess.create).not.toHaveBeenCalled();
    },
  );

  it('accepts an Alumni transition with an explicit origin position', async () => {
    const result = await service.create('actor', {
      ...createDto(),
      kind: 'ALUMNI_TRANSITION',
      targetPositions: ['MEMBER', 'ALUMNI'],
    });
    expect(result.targetPositions).toEqual(['MEMBER', 'ALUMNI']);
  });

  it('stores a process snapshot without creating a member or Orbit account', async () => {
    const result = await service.create('actor', createDto());
    expect(result.requestedByUserId).toBe('actor');
    expect(result.source).toEqual({
      type: 'MANUAL',
      note: 'Forms response checked manually',
    });
    expect(prisma.lifecycleProcess.create).toHaveBeenCalledTimes(1);
    expect(prisma.user).not.toHaveProperty('create');
  });

  it('filters all history to the exact department scope, including IDs supplied by the client', async () => {
    await service.list('actor', { offset: 0, providerUserId: 'remote' });
    expect(prisma.lifecycleProcess.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          targetDepartmentIds: { equals: ['it'] },
        }),
      }),
    );
    prisma.lifecycleProcess.findFirst.mockResolvedValue(null);
    await expect(service.get('actor', 'other-department')).rejects.toThrow(
      NotFoundException,
    );
    expect(prisma.lifecycleProcess.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'other-department',
          targetDepartmentIds: { equals: ['it'] },
        },
      }),
    );
  });

  it('rejects requester self approval before writing', async () => {
    prisma.lifecycleProcess.findFirst.mockResolvedValue({
      ...process(),
      requestedByUserId: 'actor',
    });
    await expect(
      service.decide('actor', 'process', {
        approved: true,
        note: 'Checked all operations',
      }),
    ).rejects.toThrow(ForbiddenException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('atomically freezes the approval and only queues automatic operations', async () => {
    await service.decide('actor', 'process', {
      approved: true,
      note: 'Checked all operations',
    });
    expect(prisma.lifecycleProcess.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'process', status: 'PENDING_APPROVAL', version: 2 },
      }),
    );
    expect(prisma.processApproval.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        decidedById: 'actor',
        snapshot: expect.objectContaining({ operations: expect.any(Array) }),
      }),
    });
    expect(prisma.accessOperation.update).toHaveBeenCalledWith({
      where: { id: 'operation' },
      data: { status: 'PENDING' },
    });
  });

  it('rejects concurrent decisions without creating an approval', async () => {
    prisma.lifecycleProcess.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      service.decide('actor', 'process', {
        approved: false,
        note: 'Reject scope',
      }),
    ).rejects.toThrow(ConflictException);
    expect(prisma.processApproval.create).not.toHaveBeenCalled();
  });

  it('does not allow a manual success to forge an automatic provider result', async () => {
    prisma.lifecycleProcess.findFirst.mockResolvedValue({
      ...process(),
      status: 'APPROVED',
    });
    await expect(
      service.confirm('actor', 'process', 'operation', {
        outcome: 'SUCCEEDED',
        note: 'Claim success',
      }),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.operationEvidence.create).not.toHaveBeenCalled();
  });

  it('preserves partial failures until every operation is terminal', async () => {
    prisma.accessOperation.count.mockResolvedValue(1);
    await service.completeIfReady(prisma as never, 'process');
    expect(prisma.lifecycleProcess.updateMany).not.toHaveBeenCalled();
  });
});
