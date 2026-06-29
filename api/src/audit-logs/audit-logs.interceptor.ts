import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { PrismaService } from '../prisma.service';

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

function getEntityId(request: any): string | null {
  return request.params?.id || request.params?.projectId || request.params?.userId || null;
}

function isMutating(method: string): boolean {
  return MUTATING_METHODS.includes(method);
}

function shouldSkip(request: any): boolean {
  return SKIP_PATHS.some((p) => request.route?.path === p || request.url?.startsWith(p));
}

@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  constructor(private prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
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
        next: (responseBody: any) => {
          const id = entityId || responseBody?.id || responseBody?.data?.id || 'unknown';
          this.prisma.auditLog
            .create({ data: { performedById: user.userId, action, entity, entityId: id } })
            .catch(() => {});
        },
      }),
    );
  }
}
