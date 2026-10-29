import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { LifecycleService } from './lifecycle.service';
import { PrismaService } from '../prisma.service';
import { IntakeService } from './intake.service';
import { ConnectorsService } from './connectors.service';
import { env } from 'node:process';

describe('LifecycleService', () => {
  const prisma = {
    user: { findUnique: jest.fn() },
    department: { count: jest.fn(), findMany: jest.fn() },
    accessPolicy: { findMany: jest.fn() },
    accessResource: { findMany: jest.fn() },
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
  const intake = { responses: jest.fn(), find: jest.fn() };
  const connectors = { resolveIdentity: jest.fn() };
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
          result: { accountName: 'person' },
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

  it('rejects grants in a total offboarding and revocations without verified identity', async () => {
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
