import { randomUUID } from 'node:crypto';
import { PrismaService } from '../src/prisma.service';
import { LifecycleService } from '../src/access-lifecycle/lifecycle.service';
import { LifecycleWorker } from '../src/access-lifecycle/lifecycle.worker';
import { ConnectorsService } from '../src/access-lifecycle/connectors.service';
import { IntakeService } from '../src/access-lifecycle/intake.service';

describe('Access lifecycle persistence and concurrency (PostgreSQL)', () => {
  const prisma = new PrismaService();
  const connectors = {
    execute: jest
      .fn()
      .mockResolvedValue({ status: 'SUCCEEDED', detail: 'Provider verified' }),
    asJson: (value: unknown) => value,
  };
  const lifecycle = new LifecycleService(
    prisma,
    {} as IntakeService,
    connectors as unknown as ConnectorsService,
  );
  const suffix = randomUUID();
  const departmentId = randomUUID();
  const otherDepartmentId = randomUUID();
  const requesterId = randomUUID();
  const approverId = randomUUID();
  const outsiderId = randomUUID();
  const roleId = randomUUID();
  const resourceId = randomUUID();
  const ids: string[] = [];
  beforeAll(async () => {
    await prisma.$connect();
    await prisma.department.createMany({
      data: [
        { id: departmentId, name: `Lifecycle ${suffix}` },
        { id: otherDepartmentId, name: `Other lifecycle ${suffix}` },
      ],
    });
    await prisma.role.create({
      data: {
        id: roleId,
        name: `Lifecycle ${suffix}`,
        permissions: [
          'ACCESS_READ',
          'ACCESS_CREATE',
          'ACCESS_APPROVE',
          'ACCESS_EXECUTE',
        ],
      },
    });
    await prisma.user.createMany({
      data: [requesterId, approverId, outsiderId].map((id, index) => ({
        id,
        name: 'Operator',
        email: `lifecycle-${index}-${suffix}@example.test`,
        password: 'not-used-for-authentication',
        departmentId: id === outsiderId ? otherDepartmentId : departmentId,
      })),
    });
    await prisma.userRole.createMany({
      data: [requesterId, approverId, outsiderId].map((userId) => ({
        userId,
        roleId,
      })),
    });
    await prisma.accessResource.create({
      data: {
        id: resourceId,
        name: `Test Figma team ${suffix}`,
        provider: 'FIGMA',
        remoteId: 'test-team',
        resourceType: 'FIGMA_TEAM',
        automatic: false,
      },
    });
  });
  afterAll(async () => {
    await prisma.operationEvidence.deleteMany({
      where: { operation: { processId: { in: ids } } },
    });
    await prisma.processApproval.deleteMany({
      where: { processId: { in: ids } },
    });
    await prisma.accessOperation.deleteMany({
      where: { processId: { in: ids } },
    });
    await prisma.lifecycleProcess.deleteMany({ where: { id: { in: ids } } });
    await prisma.accessResource.deleteMany({ where: { id: resourceId } });
    await prisma.user.deleteMany({
      where: { id: { in: [requesterId, approverId, outsiderId] } },
    });
    await prisma.role.deleteMany({ where: { id: roleId } });
    await prisma.department.deleteMany({
      where: { id: { in: [departmentId, otherDepartmentId] } },
    });
    await prisma.$disconnect();
  });

  async function createProcess() {
    const process = await lifecycle.create(requesterId, {
      kind: 'ONBOARD',
      targetName: 'External person',
      targetEmail: 'external@example.test',
      targetDepartmentIds: [departmentId],
      targetPositions: ['MEMBER'],
      reason: 'Onboarding external access',
      sourceNote: 'Forms response verified manually',
      selectedOperations: [
        {
          resourceId,
          action: 'GRANT',
          providerUserId: 'remote-person',
          verificationNote: 'Verified Figma account',
          exceptionReason: 'Explicit approved resource selection',
        },
      ],
    });
    ids.push(process.id);
    return process;
  }

  it('blocks access across departments and self approval without creating a target User', async () => {
    const before = await prisma.user.count();
    const process = await createProcess();
    await expect(lifecycle.get(outsiderId, process.id)).rejects.toThrow(
      'não encontrado',
    );
    await lifecycle.submit(requesterId, process.id);
    await expect(
      lifecycle.decide(requesterId, process.id, {
        approved: true,
        note: 'Own approval',
      }),
    ).rejects.toThrow('próprio pedido');
    expect(await prisma.user.count()).toBe(before);
  });

  it('commits only one concurrent decision and keeps sent invitations incomplete', async () => {
    const process = await createProcess();
    await lifecycle.submit(requesterId, process.id);
    const decisions = await Promise.allSettled([
      lifecycle.decide(approverId, process.id, {
        approved: true,
        note: 'Checked all access',
      }),
      lifecycle.decide(approverId, process.id, {
        approved: false,
        note: 'Reject conflicting decision',
      }),
    ]);
    expect(
      decisions.filter((value) => value.status === 'fulfilled'),
    ).toHaveLength(1);
    const current = await lifecycle.get(approverId, process.id);
    expect(current.approvals).toHaveLength(1);
    if (current.status === 'APPROVED') {
      const pending = await lifecycle.confirm(
        approverId,
        process.id,
        current.operations[0].id,
        {
          outcome: 'AWAITING_ACCOUNT',
          note: 'Team invitation sent, waiting for acceptance',
        },
      );
      expect(pending.status).toBe('APPROVED');
      const complete = await lifecycle.confirm(
        approverId,
        process.id,
        current.operations[0].id,
        {
          outcome: 'SUCCEEDED',
          note: 'Account accepted the team invitation; membership checked',
        },
      );
      expect(complete.status).toBe('COMPLETED');
    }
  });

  it('lets only one worker claim an automatic operation across instances', async () => {
    const process = await createProcess();
    await lifecycle.submit(requesterId, process.id);
    await lifecycle.decide(approverId, process.id, {
      approved: true,
      note: 'Checked concurrent execution',
    });
    // A test connector stands in for the provider; exercise the real SQL claim and lease.
    await prisma.accessOperation.updateMany({
      where: { processId: process.id },
      data: { automatic: true, status: 'PENDING' },
    });
    processEnvDryRun(false);
    const one = new LifecycleWorker(
      prisma,
      connectors as unknown as ConnectorsService,
      lifecycle,
    );
    const two = new LifecycleWorker(
      prisma,
      connectors as unknown as ConnectorsService,
      lifecycle,
    );
    connectors.execute.mockClear();
    try {
      await Promise.all([one.tick(), two.tick()]);
    } finally {
      delete globalThis.process.env.ACCESS_EXECUTOR_DRY_RUN;
    }
    expect(connectors.execute).toHaveBeenCalledTimes(1);
    expect((await lifecycle.get(approverId, process.id)).status).toBe(
      'COMPLETED',
    );
  });

  it('searches the human account label case-insensitively without exposing another department', async () => {
    const process = await createProcess();
    await prisma.accessOperation.updateMany({
      where: { processId: process.id },
      data: {
        providerUserId: '123456',
        result: { accountName: 'Person-Account' },
      },
    });
    expect(
      (
        await lifecycle.list(requesterId, {
          providerUserId: 'person-account',
          offset: 0,
        })
      ).some((value) => value.id === process.id),
    ).toBe(true);
    expect(
      (
        await lifecycle.list(outsiderId, {
          providerUserId: 'person-account',
          offset: 0,
        })
      ).some((value) => value.id === process.id),
    ).toBe(false);
  });

  function processEnvDryRun(value: boolean) {
    process.env.ACCESS_EXECUTOR_DRY_RUN = String(value);
  }
});
