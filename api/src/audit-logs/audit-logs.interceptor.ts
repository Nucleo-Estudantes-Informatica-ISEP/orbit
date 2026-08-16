import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { PrismaService } from '../prisma.service';
import type { Request } from 'express';
import type { AuthenticatedUser } from '../auth/authenticated-request';

type AuditRequest = Omit<Request, 'route'> & {
  route?: { path?: string };
  user?: AuthenticatedUser;
};

const ROUTE_ENTITY_MAP: Record<string, string> = {
  users: 'User',
  roles: 'Role',
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
};

const MUTATING_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'];
const SKIP_PATHS = ['/auth/login', '/auth/refresh'];

function extractEntity(path: string): string | null {
  const parts = path.split('/').filter(Boolean);
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
    null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function isMutating(method: string): boolean {
  return MUTATING_METHODS.includes(method);
}

function shouldSkip(request: AuditRequest): boolean {
  return SKIP_PATHS.some(
    (p) => request.route?.path === p || request.url?.startsWith(p),
  );
}

@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  constructor(private prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<AuditRequest>();
    const method = request.method;
    const user = request.user;

    if (!isMutating(method) || !user?.userId || shouldSkip(request)) {
      return next.handle();
    }

    const entity = extractEntity(request.route?.path || request.url || '');
    const action = extractAction(method);
    const entityId = getEntityId(request);

    if (!entity) {
      return next.handle();
    }

    return next.handle().pipe(
      tap({
        next: (responseBody: unknown) => {
          const id = entityId ?? getResponseId(responseBody) ?? 'unknown';
          void this.prisma.auditLog
            .create({
              data: {
                performedById: user.userId,
                action,
                entity,
                entityId: id,
              },
            })
            .catch(() => {});
        },
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
