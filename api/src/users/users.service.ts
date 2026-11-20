import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { MailService } from '../mail/mail.service';
import * as bcrypt from 'bcryptjs';
import type { Prisma } from '@prisma/client';
import { randomBytes } from 'node:crypto';
import { assertBcryptPasswordLength, AuthService } from '../auth/auth.service';
import {
  assertDelegation,
  securityMutation,
} from '../auth/security-administration';

const userSelect = {
  id: true,
  name: true,
  email: true,
  status: true,
  departmentId: true,
  department: {
    select: {
      id: true,
      name: true,
    },
  },
  userRoles: {
    select: {
      userId: true,
      roleId: true,
      assignedAt: true,
      role: {
        select: {
          id: true,
          name: true,
          description: true,
          permissions: true,
        },
      },
    },
  },
  createdAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private prisma: PrismaService,
    private mailService: MailService,
    private authService: AuthService,
  ) {}

  private async resolveRoles(tx: Prisma.TransactionClient, names: string[]) {
    const uniqueNames = [...new Set(names)];
    const roles = await tx.role.findMany({
      where: { name: { in: uniqueNames } },
    });
    if (roles.length !== uniqueNames.length) {
      throw new NotFoundException('Role not found');
    }
    return roles;
  }

  async create(dto: CreateUserDto, actorId: string) {
    const password = await bcrypt.hash(
      randomBytes(32).toString('base64url'),
      10,
    );
    const user = await securityMutation(
      this.prisma,
      actorId,
      'USERS_CREATE',
      async (tx, permissions) => {
        const roles = dto.roles?.length
          ? await this.resolveRoles(tx, dto.roles)
          : [];
        if (roles.length) {
          assertDelegation(permissions, [
            'ROLES_ASSIGN',
            ...roles.flatMap((role) => role.permissions),
          ]);
        }
        const created = await tx.user.create({
          data: {
            name: dto.name,
            email: dto.email,
            password,
            departmentId: dto.departmentId,
            status: dto.status,
            userRoles: { create: roles.map(({ id: roleId }) => ({ roleId })) },
          },
          select: userSelect,
        });
        await tx.auditLog.create({
          data: {
            performedById: actorId,
            action: 'CREATE',
            entity: 'User',
            entityId: created.id,
          },
        });
        return created;
      },
    );
    if (user.status === 'ACTIVE') {
      void this.authService.requestPasswordReset(user.email).catch(() => {
        this.logger.error('Password setup or recovery request failed');
      });
    }
    return user;
  }

  findAll() {
    return this.prisma.user.findMany({ select: userSelect });
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: userSelect,
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async update(id: string, dto: UpdateUserDto, actorId: string) {
    if (dto.password) assertBcryptPasswordLength(dto.password);
    const password = dto.password && (await bcrypt.hash(dto.password, 10));
    const updated = await securityMutation(
      this.prisma,
      actorId,
      'USERS_UPDATE',
      async (tx, permissions) => {
        const previous = await tx.user.findUnique({
          where: { id },
          select: userSelect,
        });
        if (!previous) throw new NotFoundException('User not found');
        assertDelegation(
          permissions,
          previous.userRoles.flatMap(({ role }) => role.permissions),
        );

        const credentialChanged = Boolean(
          password || (dto.email && dto.email !== previous.email),
        );
        if (credentialChanged)
          assertDelegation(permissions, ['USERS_MANAGE_CREDENTIALS']);

        const currentRoles = new Set(
          previous.userRoles.map(({ role }) => role.name),
        );
        const nextRoles = dto.roles && new Set(dto.roles);
        const roleChanged =
          nextRoles &&
          (nextRoles.size !== currentRoles.size ||
            [...nextRoles].some((name) => !currentRoles.has(name)));
        const roles =
          roleChanged && dto.roles
            ? await this.resolveRoles(tx, dto.roles)
            : undefined;
        if (roles) {
          assertDelegation(permissions, [
            'ROLES_ASSIGN',
            ...roles.flatMap((role) => role.permissions),
          ]);
        }

        const user = await tx.user.update({
          where: { id },
          data: {
            name: dto.name,
            email: dto.email,
            status: dto.status,
            departmentId: dto.departmentId,
            password: password || undefined,
            userRoles: roles && {
              deleteMany: {},
              create: roles.map(({ id: roleId }) => ({ roleId })),
            },
          },
          select: userSelect,
        });

        const statusChanged = previous.status !== user.status;
        if (credentialChanged || statusChanged) {
          await tx.authSession.deleteMany({ where: { userId: id } });
          await tx.passwordResetToken.updateMany({
            where: { userId: id, usedAt: null },
            data: { usedAt: new Date() },
          });
        }
        const actions = [
          'UPDATE',
          ...(credentialChanged ? ['UPDATE_CREDENTIALS'] : []),
          ...(statusChanged ? ['UPDATE_STATUS'] : []),
          ...(roleChanged ? ['ASSIGN_ROLES'] : []),
        ];
        await tx.auditLog.createMany({
          data: actions.map((action) => ({
            performedById: actorId,
            action,
            entity: 'User',
            entityId: id,
          })),
        });
        return user;
      },
    );
    if (password) {
      void this.mailService
        .sendPasswordChanged(updated.email, updated.name)
        .catch(() => {});
    }
    return updated;
  }

  remove(id: string, actorId: string) {
    if (id === actorId)
      throw new ForbiddenException('Não te podes apagar a ti próprio.');

    return securityMutation(
      this.prisma,
      actorId,
      'USERS_DELETE',
      async (tx, permissions) => {
        const target = await tx.user.findUnique({
          where: { id },
          select: userSelect,
        });
        if (!target) throw new NotFoundException('User not found');
        const targetPermissions = target.userRoles.flatMap(
          ({ role }) => role.permissions,
        );
        assertDelegation(permissions, targetPermissions);
        if (targetPermissions.includes('CAN_BE_DELETED')) {
          throw new ForbiddenException('Este utilizador não pode ser apagado.');
        }
        await tx.plan.updateMany({
          where: { createdById: id },
          data: { createdById: actorId },
        });
        const removed = await tx.user.delete({
          where: { id },
          select: userSelect,
        });
        await tx.auditLog.create({
          data: {
            performedById: actorId,
            action: 'DELETE',
            entity: 'User',
            entityId: id,
          },
        });
        return removed;
      },
    );
  }

  async getStats() {
    const [total, activeCount, inactiveCount, departmentStats, roleStats] =
      await Promise.all([
        this.prisma.user.count(),
        this.prisma.user.count({ where: { status: 'ACTIVE' } }),
        this.prisma.user.count({ where: { status: 'INACTIVE' } }),
        this.prisma.department.findMany({
          select: {
            id: true,
            name: true,
            _count: {
              select: { users: true },
            },
          },
        }),
        this.prisma.role.findMany({
          select: {
            id: true,
            name: true,
            _count: {
              select: { userRoles: true },
            },
          },
        }),
      ]);

    return {
      total,
      active: activeCount,
      inactive: inactiveCount,
      suspended: await this.prisma.user.count({
        where: { status: 'SUSPENDED' },
      }),
      byDepartment: departmentStats.map((dept) => ({
        id: dept.id,
        name: dept.name,
        count: dept._count.users,
      })),
      byRole: roleStats.map((role) => ({
        id: role.id,
        name: role.name,
        count: role._count.userRoles,
      })),
    };
  }
}
