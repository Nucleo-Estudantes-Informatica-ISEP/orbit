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
  const readPermission = `${modulePrefix}_READ`;
  const viewPermission = `${modulePrefix}_VIEW`;

  // These UI VIEW checks immediately expose data from endpoints protected by
  // *_READ. Keep them aligned with the API and fail closed unless READ exists.
  if (
    READ_BACKED_VIEW_MODULES.has(modulePrefix) &&
    (action === 'VIEW' || action === 'READ')
  ) {
    return effectivePermissions.has(readPermission);
  }

  if (effectivePermissions.has(permission)) {
    return true;
  }

  if (permission.endsWith('_READ') && effectivePermissions.has(viewPermission)) {
    return true;
  }

  if (permission.endsWith('_VIEW') && effectivePermissions.has(readPermission)) {
    return true;
  }

  if (permission.endsWith('_READ')) {
    const strongerPermissions = [
      `${modulePrefix}_CREATE`,
      `${modulePrefix}_UPDATE`,
      `${modulePrefix}_DELETE`,
    ];

    if (strongerPermissions.some((item) => effectivePermissions.has(item))) {
      return true;
    }
  }

  if (permission === 'PLANS_READ' && effectivePermissions.has('PLANS_APPROVE')) {
    return true;
  }

  if (permission === 'FILES_UPLOAD' && effectivePermissions.has('FILES_UPLOAD')) return true;

  // PLANS_APPROVE remains explicit-only.
  if (permission === 'PLANS_APPROVE') return false;

  return false;
}
