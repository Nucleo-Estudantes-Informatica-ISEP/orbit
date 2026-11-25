import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { concatMap } from 'rxjs/operators';
import { PrismaService } from '../prisma.service';
import type { Request } from 'express';
import type { AuthenticatedUser } from '../auth/authenticated-request';

type AuditRequest = Omit<Request, 'route'> & {
  route?: { path?: string };
  user?: AuthenticatedUser;
};

const ROUTE_ENTITY_MAP: Record<string, string> = {
  'access-lifecycle': 'LifecycleProcess',
  departments: 'Department',
  announcements: 'Announcement',
  events: 'Event',
  tasks: 'Task',
  projects: 'Project',
  boards: 'Board',
  candidates: 'Candidate',
  resources: 'Resource',
  inventory: 'InventoryItem',
  plans: 'Plan',
  debts: 'Debt',
  files: 'File',
  incidents: 'Incident',
  recruitment: 'RecruitmentComment',
  'user-settings': 'UserSettings',
};

const MUTATING_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'];
const WORKFLOW_ACTIONS: Record<string, string> = {
  'LifecycleProcess:submit': 'SUBMIT',
  'LifecycleProcess:cancel': 'CANCEL',
  'LifecycleProcess:confirm': 'CONFIRM_MANUAL',
  'LifecycleProcess:retry': 'RETRY',
  'LifecycleProcess:reconcile': 'RECONCILE',
  'Debt:complete': 'COMPLETE',
  'Debt:revert': 'REVERT',
  'Plan:approve': 'APPROVE',
  'Plan:reject': 'REJECT',
  'Department:transferAndDelete': 'TRANSFER_AND_DELETE',
  'Project:addMember': 'ADD_MEMBER',
  'Project:removeMember': 'REMOVE_MEMBER',
  'Announcement:markRead': 'MARK_READ',
  'Announcement:markAllRead': 'MARK_ALL_READ',
  'Announcement:togglePin': 'TOGGLE_PIN',
};

function extractEntity(path: string): string | null {
  const parts = path.split('?')[0].split('/').filter(Boolean);
  const prefix = parts[0];
  if (prefix && ROUTE_ENTITY_MAP[prefix]) {
    return ROUTE_ENTITY_MAP[prefix];
  }
  if (parts.length >= 2 && ROUTE_ENTITY_MAP[parts[1]]) {
    return ROUTE_ENTITY_MAP[parts[1]];
  }
  return null;
}

function extractAction(method: string): string {
  if (method === 'POST') return 'CREATE';
  if (method === 'DELETE') return 'DELETE';
  return 'UPDATE';
}

function getEntityId(request: AuditRequest): string | null {
  const value =
    request.params?.id ||
    request.params?.projectId ||
    request.params?.userId ||
    request.params?.commentId ||
    request.params?.key ||
    null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function isMutating(method: string): boolean {
  return MUTATING_METHODS.includes(method);
}

@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditLogInterceptor.name);
  constructor(private prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<AuditRequest>();
    const method = request.method;
    const user = request.user;

    if (!isMutating(method) || !user?.userId) {
      return next.handle();
    }

    const entity = extractEntity(request.route?.path || request.url || '');
    const entityId = getEntityId(request);

    if (!entity) {
      return next.handle();
    }
    if (
      entity === 'LifecycleProcess' &&
      context.getHandler().name === 'decide'
    ) {
      return next.handle();
    }

    const action =
      WORKFLOW_ACTIONS[`${entity}:${context.getHandler().name}`] ??
      extractAction(method);
    return next.handle().pipe(
      concatMap(async (responseBody: unknown) => {
        const id = entityId ?? getResponseId(responseBody) ?? 'unknown';
        try {
          await this.prisma.auditLog.create({
            data: { performedById: user.userId, action, entity, entityId: id },
          });
        } catch {
          this.logger.error(
            `Could not persist server audit event ${entity}:${action}`,
          );
        }
        return responseBody;
      }),
    );
  }
}

function getResponseId(responseBody: unknown): string | null {
  if (!responseBody || typeof responseBody !== 'object') {
    return null;
  }

  if ('id' in responseBody && typeof responseBody.id === 'string') {
    return responseBody.id;
  }

  if ('data' in responseBody) {
    const data = responseBody.data;
    if (
      data &&
      typeof data === 'object' &&
      'id' in data &&
      typeof data.id === 'string'
    ) {
      return data.id;
    }
  }

  return null;
}
