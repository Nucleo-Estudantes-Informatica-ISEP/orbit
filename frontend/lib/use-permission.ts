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

  // These dashboard/navigation VIEW checks expose data from endpoints protected
  // by *_READ. Fail closed unless the user can actually read that data.
  if (action === 'VIEW' && READ_BACKED_VIEW_MODULES.has(modulePrefix)) {
    return effectivePermissions.has(`${modulePrefix}_READ`);
  }

  if (effectivePermissions.has(permission)) {
    return true;
  }

  // For modules whose API uses *_VIEW directly (for example files), keep VIEW
  // exact. READ may expose a read-only UI when both permissions exist.
  if (action === 'VIEW' && effectivePermissions.has(`${modulePrefix}_READ`)) {
    return true;
  }

  if (permission === 'PLANS_READ' && effectivePermissions.has('PLANS_APPROVE')) {
    return true;
  }

  // PLANS_APPROVE remains explicit-only.
  if (permission === 'PLANS_APPROVE') return false;

  return false;
}
