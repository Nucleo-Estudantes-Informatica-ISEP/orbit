import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma.service';
import { ConnectorsService } from './connectors.service';
import { LifecycleService } from './lifecycle.service';
import { ProviderError } from './provider-http';

@Injectable()
export class LifecycleWorker implements OnModuleInit, OnModuleDestroy {
  private timer?: NodeJS.Timeout;
  private busy = false;
  private readonly logger = new Logger(LifecycleWorker.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly connectors: ConnectorsService,
    private readonly lifecycle: LifecycleService,
  ) {}

  onModuleInit() {
    if (process.env.ACCESS_EXECUTOR_ENABLED !== 'true') return;
    this.timer = setInterval(() => {
      void this.tick().catch(() =>
        this.logger.error('ACCESS_EXECUTOR_DATABASE_ERROR'),
      );
    }, 5000);
    this.timer.unref();
  }
  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async tick() {
    if (this.busy) return;
    this.busy = true;
    try {
      // Compare-and-swap claims avoid overlapping work between API instances.
      // Expired leases recover jobs interrupted by a restart.
      const now = new Date();
      const eligible = {
        automatic: true,
        process: { status: 'APPROVED' as const },
        OR: [
          { status: 'PENDING' as const, nextAttemptAt: { lte: now } },
          { status: 'RUNNING' as const, leaseUntil: { lt: now } },
        ],
      };
      const candidate =
        (await this.prisma.accessOperation.findFirst({
          where: { ...eligible, action: 'REVOKE' },
          orderBy: { nextAttemptAt: 'asc' },
        })) ||
        (await this.prisma.accessOperation.findFirst({
          where: eligible,
          orderBy: { nextAttemptAt: 'asc' },
        }));
      if (!candidate) return;
      if (candidate.attempts >= 8) {
        await this.prisma.accessOperation.updateMany({
          where: {
            id: candidate.id,
            status: candidate.status,
            updatedAt: candidate.updatedAt,
          },
          data: {
            status: 'FAILED',
            lastError: 'ATTEMPT_LIMIT',
            leaseUntil: null,
            leaseToken: null,
          },
        });
        return;
      }
      const token = randomUUID();
      const claim = await this.prisma.accessOperation.updateMany({
        where: {
          id: candidate.id,
          status: candidate.status,
          updatedAt: candidate.updatedAt,
        },
        data: {
          status: 'RUNNING',
          leaseToken: token,
          leaseUntil: new Date(Date.now() + 120000),
          attempts: { increment: 1 },
        },
      });
      if (!claim.count) return;
      const heartbeat = setInterval(() => {
        void this.prisma.accessOperation
          .updateMany({
            where: { id: candidate.id, leaseToken: token, status: 'RUNNING' },
            data: { leaseUntil: new Date(Date.now() + 120000) },
          })
          .catch(() => this.logger.error('ACCESS_EXECUTOR_LEASE_ERROR'));
      }, 20000);
      heartbeat.unref();
      try {
        const dryRun = process.env.ACCESS_EXECUTOR_DRY_RUN !== 'false';
        const observed = await this.connectors.execute(
          dryRun ? { ...candidate, action: 'VERIFY' } : candidate,
        );
        const result = dryRun
          ? {
              ...observed,
              status: 'AWAITING_MANUAL' as const,
              detail: `DRY_RUN: ${observed.detail}. Nenhuma alteração executada; desativar dry-run e repetir ou concluir manualmente.`,
            }
          : observed;
        const declaredIdentity = candidate.result as {
          accountName?: string;
          identitySource?: 'SHEETS' | 'OPERATOR';
        } | null;
        await this.prisma.$transaction(async (tx) => {
          const changed = await tx.accessOperation.updateMany({
            where: { id: candidate.id, status: 'RUNNING', leaseToken: token },
            data: {
              status: result.status,
              result: this.connectors.asJson({
                ...result,
                ...(declaredIdentity?.accountName
                  ? { accountName: declaredIdentity.accountName }
                  : {}),
                ...(declaredIdentity?.identitySource
                  ? { identitySource: declaredIdentity.identitySource }
                  : {}),
              }),
              lastError: null,
              leaseToken: null,
              leaseUntil: null,
              ...(result.remoteId ? { providerUserId: result.remoteId } : {}),
            },
          });
          if (changed.count)
            await this.lifecycle.completeIfReady(tx, candidate.processId);
        });
      } catch (error) {
        const known = error instanceof ProviderError;
        const retry = known && error.retryable && candidate.attempts + 1 < 5;
        await this.prisma.accessOperation.updateMany({
          where: { id: candidate.id, status: 'RUNNING', leaseToken: token },
          data: {
            status: retry ? 'PENDING' : 'FAILED',
            lastError: known ? error.code : 'EXECUTION_FAILED',
            nextAttemptAt: new Date(
              Date.now() + Math.min(3600000, 30000 * 2 ** candidate.attempts),
            ),
            leaseToken: null,
            leaseUntil: null,
          },
        });
      } finally {
        clearInterval(heartbeat);
      }
    } finally {
      this.busy = false;
    }
  }
}
