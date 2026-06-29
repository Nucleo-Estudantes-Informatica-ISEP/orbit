import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import * as bcrypt from 'bcryptjs';

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
        },
      },
    },
  },
  createdAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateUserDto) {
    const hashed = await bcrypt.hash(dto.password, 10);
    const createdUser = await this.prisma.user.create({
      data: {
        name: dto.name,
        email: dto.email,
        password: hashed,
        departmentId: dto.departmentId,
      },
      select: userSelect,
    });

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
    const updateData: any = {};

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

  async remove(id: string) {
    return this.prisma.user.delete({ where: { id } });
  }

  async getStats() {
    const [total, activeCount, inactiveCount, departmentStats, roleStats] = await Promise.all([
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
      suspended: await this.prisma.user.count({ where: { status: 'SUSPENDED' } }),
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

