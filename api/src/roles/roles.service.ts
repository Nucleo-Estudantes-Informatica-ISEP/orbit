import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateRoleDto } from './create-role.dto';
import type { SystemPermission } from '@prisma/client';

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

  create(dto: CreateRoleDto) {
    return this.prisma.role.create({
      data: {
        name: dto.name,
        description: dto.description,
        permissions: (dto.permissions ?? []) as SystemPermission[],
      },
      select: roleSelect,
    });
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

  update(id: string, dto: Partial<CreateRoleDto>) {
    return this.prisma.role.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        permissions: dto.permissions
          ? (dto.permissions as SystemPermission[])
          : undefined,
      },
      select: roleSelect,
    });
  }

  remove(id: string) {
    return this.prisma.role.delete({ where: { id } });
  }

  async getUserCount(id: string) {
    const role = await this.prisma.role.findUnique({
      where: { id },
      select: { userRoles: true },
    });

    if (!role) throw new NotFoundException('Role not found');
    return { count: role.userRoles.length };
  }

  async transferAndDelete(id: string, destinationRoleId: string) {
    // Verify destination role exists
    const destinationRole = await this.prisma.role.findUnique({
      where: { id: destinationRoleId },
    });

    if (!destinationRole)
      throw new NotFoundException('Destination role not found');

    // Get all user-role associations for the role being deleted
    const userRoles = await this.prisma.userRole.findMany({
      where: { roleId: id },
    });

    // Transfer users to destination role
    if (userRoles.length > 0) {
      // Delete existing associations with the source role
      await this.prisma.userRole.deleteMany({
        where: { roleId: id },
      });

      // Create new associations with the destination role
      await this.prisma.userRole.createMany({
        data: userRoles.map((ur) => ({
          userId: ur.userId,
          roleId: destinationRoleId,
        })),
        skipDuplicates: true, // In case user already has the destination role
      });
    }

    // Delete the role
    return this.prisma.role.delete({ where: { id } });
  }
}
