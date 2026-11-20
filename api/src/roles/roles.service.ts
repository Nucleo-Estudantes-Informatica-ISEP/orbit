import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateRoleDto } from './create-role.dto';
import {
  assertDelegation,
  securityMutation,
} from '../auth/security-administration';

const roleSelect = {
  id: true,
  name: true,
  description: true,
  permissions: true,
  userRoles: {
    select: {
      userId: true,
    },
  },
  createdAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class RolesService {
  constructor(private prisma: PrismaService) {}

  create(dto: CreateRoleDto, actorId: string) {
    return securityMutation(
      this.prisma,
      actorId,
      'ROLES_CREATE',
      async (tx, permissions) => {
        assertDelegation(permissions, dto.permissions ?? []);
        const role = await tx.role.create({ data: dto, select: roleSelect });
        await tx.auditLog.create({
          data: {
            performedById: actorId,
            action: 'CREATE',
            entity: 'Role',
            entityId: role.id,
          },
        });
        return role;
      },
    );
  }

  findAll() {
    return this.prisma.role.findMany({
      select: roleSelect,
    });
  }

  async findOne(id: string) {
    const role = await this.prisma.role.findUnique({
      where: { id },
      select: roleSelect,
    });

    if (!role) throw new NotFoundException('Role not found');
    return role;
  }

  update(id: string, dto: Partial<CreateRoleDto>, actorId: string) {
    return securityMutation(
      this.prisma,
      actorId,
      'ROLES_UPDATE',
      async (tx, permissions) => {
        const current = await tx.role.findUnique({
          where: { id },
          select: roleSelect,
        });
        if (!current) throw new NotFoundException('Role not found');
        assertDelegation(permissions, [
          ...current.permissions,
          ...(dto.permissions ?? []),
        ]);
        if (
          current.userRoles.length &&
          dto.permissions &&
          (new Set(dto.permissions).size !==
            new Set(current.permissions).size ||
            dto.permissions.some(
              (permission) => !current.permissions.includes(permission),
            ))
        ) {
          assertDelegation(permissions, ['ROLES_ASSIGN']);
        }
        const role = await tx.role.update({
          where: { id },
          data: dto,
          select: roleSelect,
        });
        await tx.auditLog.create({
          data: {
            performedById: actorId,
            action: dto.permissions ? 'UPDATE_PERMISSIONS' : 'UPDATE',
            entity: 'Role',
            entityId: id,
          },
        });
        return role;
      },
    );
  }

  remove(id: string, actorId: string) {
    return securityMutation(
      this.prisma,
      actorId,
      'ROLES_DELETE',
      async (tx, permissions) => {
        const current = await tx.role.findUnique({
          where: { id },
          select: roleSelect,
        });
        if (!current) throw new NotFoundException('Role not found');
        assertDelegation(permissions, current.permissions);
        const role = await tx.role.delete({
          where: { id },
          select: roleSelect,
        });
        await tx.auditLog.create({
          data: {
            performedById: actorId,
            action: 'DELETE',
            entity: 'Role',
            entityId: id,
          },
        });
        return role;
      },
    );
  }

  async getUserCount(id: string) {
    const role = await this.prisma.role.findUnique({
      where: { id },
      select: { userRoles: true },
    });

    if (!role) throw new NotFoundException('Role not found');
    return { count: role.userRoles.length };
  }

  transferAndDelete(id: string, destinationRoleId: string, actorId: string) {
    if (id === destinationRoleId)
      throw new BadRequestException('Choose a different destination role');

    return securityMutation(
      this.prisma,
      actorId,
      'ROLES_DELETE',
      async (tx, permissions) => {
        const [source, destination] = await Promise.all([
          tx.role.findUnique({ where: { id }, select: roleSelect }),
          tx.role.findUnique({
            where: { id: destinationRoleId },
            select: roleSelect,
          }),
        ]);
        if (!source || !destination)
          throw new NotFoundException('Role not found');
        assertDelegation(permissions, [
          'ROLES_ASSIGN',
          ...source.permissions,
          ...destination.permissions,
        ]);

        if (source.userRoles.length) {
          await tx.userRole.createMany({
            data: source.userRoles.map(({ userId }) => ({
              userId,
              roleId: destinationRoleId,
            })),
            skipDuplicates: true,
          });
        }
        const role = await tx.role.delete({
          where: { id },
          select: roleSelect,
        });
        await tx.auditLog.create({
          data: {
            performedById: actorId,
            action: 'TRANSFER_AND_DELETE',
            entity: 'Role',
            entityId: id,
          },
        });
        return role;
      },
    );
  }
}
