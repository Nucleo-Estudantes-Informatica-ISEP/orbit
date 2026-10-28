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
  const service = new LifecycleService(
    prisma as unknown as PrismaService,
    {} as IntakeService,
    {} as ConnectorsService,
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
