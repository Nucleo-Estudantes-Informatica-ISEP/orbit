'use client';

import { useAuth } from '@/lib/auth-context';

export function usePermission(permission: string): boolean {
  const { user } = useAuth();
  if (!user) return false;

  const effectivePermissions = new Set(user.permissions ?? []);

  if (effectivePermissions.has(permission)) {
    return true;
  }

  const modulePrefix = permission.includes('_') ? permission.slice(0, permission.indexOf('_')) : permission;
  const readPermission = `${modulePrefix}_READ`;
  const viewPermission = `${modulePrefix}_VIEW`;

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

  // Extract action: split on first underscore, join the rest (handles PLANS_APPROVE)
  const underscoreIdx = permission.indexOf('_');
  const action = underscoreIdx >= 0 ? permission.slice(underscoreIdx + 1) : permission;

  if (permission === 'FILES_UPLOAD' && effectivePermissions.has('FILES_UPLOAD')) return true;
  if (action === 'VIEW' && effectivePermissions.has(viewPermission)) return true;

  // PLANS_APPROVE remains explicit-only.
  if (permission === 'PLANS_APPROVE') return false;

  return false;
}
