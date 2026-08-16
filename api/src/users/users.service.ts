import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { MailService } from '../mail/mail.service';
import * as bcrypt from 'bcryptjs';
import { type Prisma, SystemPermission } from '@prisma/client';

const CRITICAL_PERMISSIONS: SystemPermission[] = [
  'USERS_CREATE',
  'USERS_UPDATE',
  'ROLES_CREATE',
  'ROLES_UPDATE',
];

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
  constructor(
    private prisma: PrismaService,
    private mailService: MailService,
  ) {}

  async create(dto: CreateUserDto) {
    const hashed = await bcrypt.hash(dto.password, 10);
    const createdUser = await this.prisma.user.create({
      data: {
        name: dto.name,
        email: dto.email,
        password: hashed,
        departmentId: dto.departmentId,
        ...(dto.status ? { status: dto.status } : {}),
      },
      select: userSelect,
    });

    this.mailService
      .sendWelcomeEmail(dto.email, dto.name, dto.password)
      .catch(() => {});

    if (dto.roles?.length) {
      const roles = await this.prisma.role.findMany({
        where: {
          name: {
            in: dto.roles,
          },
        },
      });

      for (const role of roles) {
        await this.prisma.userRole.create({
          data: {
            userId: createdUser.id,
            roleId: role.id,
          },
        });
      }

      return this.findOne(createdUser.id);
    }

    return createdUser;
  }

  async findAll() {
    return this.prisma.user.findMany({
      select: userSelect,
    });
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: userSelect,
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async update(id: string, dto: UpdateUserDto) {
    const updateData: Prisma.UserUncheckedUpdateInput = {};

    if (dto.name) updateData.name = dto.name;
    if (dto.email) updateData.email = dto.email;
    if (dto.status) updateData.status = dto.status;
    if (dto.departmentId) updateData.departmentId = dto.departmentId;
    if (dto.password) updateData.password = await bcrypt.hash(dto.password, 10);

    const updatedUser = await this.prisma.user.update({
      where: { id },
      data: updateData,
      select: userSelect,
    });

    if (dto.password) {
      this.mailService
        .sendPasswordChanged(updatedUser.email, updatedUser.name)
        .catch(() => {});
    }

    // Update roles if provided
    if (dto.roles && Array.isArray(dto.roles)) {
      // Delete existing roles
      await this.prisma.userRole.deleteMany({
        where: { userId: id },
      });

      // Create new roles
      const roles = await this.prisma.role.findMany({
        where: {
          name: {
            in: dto.roles,
          },
        },
      });

      for (const role of roles) {
        await this.prisma.userRole.create({
          data: {
            userId: id,
            roleId: role.id,
          },
        });
      }

      // Fetch updated user with new roles
      return this.findOne(id);
    }

    return updatedUser;
  }

  async remove(id: string, requestingUserId: string) {
    if (id === requestingUserId) {
      throw new ForbiddenException('Não te podes apagar a ti próprio.');
    }

    const target = await this.prisma.user.findUnique({
      where: { id },
      include: {
        userRoles: {
          include: { role: { select: { permissions: true } } },
        },
      },
    });
    if (!target) throw new NotFoundException('User not found');

    const targetPermissions = new Set(
      target.userRoles.flatMap((ur) => ur.role.permissions),
    );
    if (targetPermissions.has('CAN_BE_DELETED')) {
      throw new ForbiddenException('Este utilizador não pode ser apagado.');
    }

    const hasCritical = CRITICAL_PERMISSIONS.some((p) =>
      targetPermissions.has(p),
    );

    if (hasCritical) {
      const criticalUsers = await this.prisma.user.findMany({
        where: { status: 'ACTIVE' },
        include: {
          userRoles: {
            include: { role: { select: { permissions: true } } },
          },
        },
      });

      const countWithCritical = criticalUsers.filter((u) =>
        CRITICAL_PERMISSIONS.some((p) =>
          u.userRoles.some((ur) => ur.role.permissions.includes(p)),
        ),
      ).length;

      if (countWithCritical <= 1) {
        throw new ForbiddenException(
          'Não é possível apagar o último utilizador com permissões críticas.',
        );
      }
    }

    await this.prisma.plan.updateMany({
      where: { createdById: id },
      data: { createdById: requestingUserId },
    });

    return this.prisma.user.delete({ where: { id } });
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
