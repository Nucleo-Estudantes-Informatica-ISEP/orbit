import { ConflictException, ForbiddenException } from '@nestjs/common';
import { Prisma, type SystemPermission } from '@prisma/client';
import type { PrismaService } from '../prisma.service';

const administratorPermissions: SystemPermission[] = [
  'USERS_CREATE',
  'USERS_UPDATE',
  'USERS_DELETE',
  'USERS_MANAGE_CREDENTIALS',
  'ROLES_CREATE',
  'ROLES_UPDATE',
  'ROLES_DELETE',
  'ROLES_ASSIGN',
];
const membership = {
  userRoles: { select: { role: { select: { permissions: true } } } },
} as const;

type MemberPermissions = Prisma.UserGetPayload<{ select: typeof membership }>;

function permissionsFor(member: MemberPermissions) {
  return new Set(member.userRoles.flatMap(({ role }) => role.permissions));
}

export function assertDelegation(
  permissions: Set<SystemPermission>,
  requested: readonly SystemPermission[],
) {
  if (!requested.every((permission) => permissions.has(permission))) {
    throw new ForbiddenException(
      'The operation exceeds your administrative permissions',
    );
  }
}

async function activeAdministratorExists(tx: Prisma.TransactionClient) {
  const members = await tx.user.findMany({
    where: { status: 'ACTIVE' },
    select: membership,
  });
  return members.some((member) => {
    const permissions = permissionsFor(member);
    return administratorPermissions.every((permission) =>
      permissions.has(permission),
    );
  });
}

export async function securityMutation<TResult>(
  prisma: PrismaService,
  actorId: string,
  required: SystemPermission,
  perform: (
    tx: Prisma.TransactionClient,
    permissions: Set<SystemPermission>,
  ) => Promise<TResult>,
): Promise<TResult> {
  try {
    return await prisma.$transaction(
      async (tx) => {
        const actor = await tx.user.findFirst({
          where: { id: actorId, status: 'ACTIVE' },
          select: membership,
        });
        if (!actor)
          throw new ForbiddenException('Active administrator required');
        const permissions = permissionsFor(actor);
        assertDelegation(permissions, [required]);
        const hadAdministrator = await activeAdministratorExists(tx);
        const result = await perform(tx, permissions);
        if (hadAdministrator && !(await activeAdministratorExists(tx))) {
          throw new ForbiddenException(
            'The last active administrator must retain their permissions',
          );
        }
        return result;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2034'
    ) {
      throw new ConflictException(
        'Administrative data changed. Reload and retry.',
      );
    }
    throw error;
  }
}
