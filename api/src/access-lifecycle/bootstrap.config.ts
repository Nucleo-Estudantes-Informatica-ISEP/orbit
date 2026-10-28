import { PrismaClient, SystemPermission } from '@prisma/client';

type ResourcePatch = {
  remoteId?: string;
  containerId?: string;
  adminUrl?: string;
  enabled?: boolean;
  automatic?: boolean;
};
export interface AccessBootstrap {
  resources: Record<string, ResourcePatch>;
  rolePermissions?: Record<string, SystemPermission[]>;
}

function invalid(): never {
  throw new Error('Invalid access bootstrap configuration');
}
function record(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function readAccessBootstrap(
  env: Record<string, string | undefined>,
): AccessBootstrap {
  let resources: unknown;
  let roles: unknown;
  try {
    resources = JSON.parse(env.ACCESS_BOOTSTRAP_RESOURCES || '{}');
    roles = env.ACCESS_BOOTSTRAP_ROLE_PERMISSIONS
      ? JSON.parse(env.ACCESS_BOOTSTRAP_ROLE_PERMISSIONS)
      : undefined;
  } catch {
    return invalid();
  }
  if (!record(resources) || (roles !== undefined && !record(roles)))
    return invalid();
  for (const patch of Object.values(resources)) {
    if (!record(patch)) return invalid();
    for (const [key, value] of Object.entries(patch)) {
      if (
        ![
          'remoteId',
          'containerId',
          'adminUrl',
          'enabled',
          'automatic',
        ].includes(key)
      )
        return invalid();
      if (['enabled', 'automatic'].includes(key)) {
        if (typeof value !== 'boolean') return invalid();
      } else if (
        typeof value !== 'string' ||
        !value.trim() ||
        value.length > (key === 'adminUrl' ? 1000 : 200)
      )
        return invalid();
      if (key === 'adminUrl') {
        try {
          if (new URL(String(value)).protocol !== 'https:') return invalid();
        } catch {
          return invalid();
        }
      }
    }
  }
  const accessPermissions = new Set<string>(
    Object.values(SystemPermission).filter((value) =>
      value.startsWith('ACCESS_'),
    ),
  );
  for (const permissions of Object.values(roles || {})) {
    if (
      !Array.isArray(permissions) ||
      !permissions.every(
        (value) => typeof value === 'string' && accessPermissions.has(value),
      )
    )
      return invalid();
  }
  return {
    resources: resources as Record<string, ResourcePatch>,
    ...(roles
      ? { rolePermissions: roles as Record<string, SystemPermission[]> }
      : {}),
  };
}

export async function applyAccessBootstrap(
  prisma: PrismaClient,
  resourceIds: Record<string, string>,
  config: AccessBootstrap,
) {
  await prisma.$transaction(async (tx) => {
    const updates: { id: string; patch: ResourcePatch }[] = [];
    const roles: { id: string; permissions: SystemPermission[] }[] = [];
    for (const [key, patch] of Object.entries(config.resources)) {
      if (!Object.prototype.hasOwnProperty.call(resourceIds, key))
        return invalid();
      const current = await tx.accessResource.findUnique({
        where: { id: resourceIds[key] },
      });
      if (!current) return invalid();
      const next = { ...current, ...patch };
      if (next.enabled && next.remoteId === 'CONFIGURE_ME') return invalid();
      if (
        next.automatic &&
        !['DISCORD', 'GITHUB', 'GOOGLE_DRIVE'].includes(next.provider)
      )
        return invalid();
      if (
        next.automatic &&
        (next.provider === 'DISCORD' || next.resourceType === 'GITHUB_TEAM') &&
        !next.containerId
      )
        return invalid();
      if (
        next.provider === 'DISCORD' &&
        /server.?manager/i.test(next.name) &&
        (next.automatic || !next.sensitive)
      )
        return invalid();
      if (
        !Object.entries(patch).every(
          ([field, value]) => current[field] === value,
        )
      )
        updates.push({ id: current.id, patch });
    }
    for (const [name, permissions] of Object.entries(
      config.rolePermissions || {},
    )) {
      const current = await tx.role.findUnique({ where: { name } });
      if (!current) return invalid();
      const next = [
        ...new Set([
          ...current.permissions.filter(
            (value) => !value.startsWith('ACCESS_'),
          ),
          ...permissions,
        ]),
      ];
      if (JSON.stringify(current.permissions) !== JSON.stringify(next))
        roles.push({ id: current.id, permissions: next });
    }
    for (const update of updates)
      await tx.accessResource.update({
        where: { id: update.id },
        data: { ...update.patch, version: { increment: 1 } },
      });
    for (const role of roles)
      await tx.role.update({
        where: { id: role.id },
        data: { permissions: role.permissions },
      });
  });
}
