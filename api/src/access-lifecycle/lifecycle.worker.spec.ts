import { LifecycleWorker } from './lifecycle.worker';
import { PrismaService } from '../prisma.service';
import { ConnectorsService } from './connectors.service';
import { LifecycleService } from './lifecycle.service';
import { ProviderError } from './provider-http';

describe('persistent access executor', () => {
  const prisma = {
    accessOperation: { findFirst: jest.fn(), updateMany: jest.fn() },
    $transaction: jest.fn(),
  };
  const connectors = { execute: jest.fn(), asJson: jest.fn((value) => value) };
  const lifecycle = { completeIfReady: jest.fn() };
  const worker = new LifecycleWorker(
    prisma as unknown as PrismaService,
    connectors as unknown as ConnectorsService,
    lifecycle as unknown as LifecycleService,
  );
  const candidate = {
    id: 'operation',
    processId: 'process',
    status: 'PENDING',
    action: 'REVOKE',
    automatic: true,
    attempts: 0,
    updatedAt: new Date(),
  };
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.ACCESS_EXECUTOR_DRY_RUN = 'false';
    prisma.accessOperation.findFirst.mockResolvedValue(candidate);
    prisma.accessOperation.updateMany.mockResolvedValue({ count: 1 });
    prisma.$transaction.mockImplementation(
      (callback: (tx: typeof prisma) => unknown) => callback(prisma),
    );
    connectors.execute.mockResolvedValue({
      status: 'SUCCEEDED',
      detail: 'Verified',
    });
  });
  afterEach(() => {
    delete process.env.ACCESS_EXECUTOR_DRY_RUN;
  });

  it('executes only the instance that atomically claims the lease', async () => {
    prisma.accessOperation.updateMany.mockResolvedValue({ count: 0 });
    await worker.tick();
    expect(connectors.execute).not.toHaveBeenCalled();
  });
  it('checks the lease token before persisting a result', async () => {
    await worker.tick();
    const claim = prisma.accessOperation.updateMany.mock.calls[0][0] as {
      data: { leaseToken: string };
    };
    expect(prisma.accessOperation.updateMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: {
          id: 'operation',
          status: 'RUNNING',
          leaseToken: claim.data.leaseToken,
        },
      }),
    );
    expect(lifecycle.completeIfReady).toHaveBeenCalledWith(prisma, 'process');
  });
  it('recovers expired final leases as failed rather than leaving them running forever', async () => {
    prisma.accessOperation.findFirst.mockResolvedValue({
      ...candidate,
      status: 'RUNNING',
      attempts: 8,
    });
    await worker.tick();
    expect(connectors.execute).not.toHaveBeenCalled();
    expect(prisma.accessOperation.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          status: 'FAILED',
          lastError: 'ATTEMPT_LIMIT',
          leaseUntil: null,
          leaseToken: null,
        },
      }),
    );
  });
  it('backs off transient failures and records only sanitized error codes', async () => {
    connectors.execute.mockRejectedValue(
      new ProviderError('PROVIDER_HTTP_429', true),
    );
    await worker.tick();
    expect(prisma.accessOperation.updateMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'PENDING',
          lastError: 'PROVIDER_HTTP_429',
          nextAttemptAt: expect.any(Date),
        }),
      }),
    );
  });
  it('defaults dry-run to read-only checks and never completes the operation', async () => {
    delete process.env.ACCESS_EXECUTOR_DRY_RUN;
    await worker.tick();
    expect(connectors.execute).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'VERIFY' }),
    );
    expect(prisma.accessOperation.updateMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'AWAITING_MANUAL' }),
      }),
    );
  });
});
