'use client';

import { useAuth } from '@/lib/auth-context';

const READ_BACKED_VIEW_MODULES = new Set([
  'ANNOUNCEMENTS',
  'DEBTS',
  'EVENTS',
  'PROJECTS',
  'RECRUITMENT',
  'TASKS',
]);

export function usePermission(permission: string): boolean {
  const { user } = useAuth();
  if (!user) return false;

  const effectivePermissions = new Set(user.permissions ?? []);
  const underscoreIdx = permission.indexOf('_');
  const modulePrefix = underscoreIdx >= 0 ? permission.slice(0, underscoreIdx) : permission;
  const action = underscoreIdx >= 0 ? permission.slice(underscoreIdx + 1) : permission;

  if (action === 'VIEW' && READ_BACKED_VIEW_MODULES.has(modulePrefix)) {
    return effectivePermissions.has(`${modulePrefix}_READ`);
  }

  return effectivePermissions.has(permission);
}
