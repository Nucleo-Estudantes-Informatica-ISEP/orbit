import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateDepartmentDto } from './dto/create-department.dto';

@Injectable()
export class DepartmentsService {
  constructor(private prisma: PrismaService) {}

  create(dto: CreateDepartmentDto) {
    return this.prisma.department.create({ data: dto });
  }

  findAll() {
    return this.prisma.department.findMany();
  }

  async findOne(id: string) {
    const d = await this.prisma.department.findUnique({ where: { id } });
    if (!d) throw new NotFoundException('Department not found');
    return d;
  }

  update(id: string, dto: Partial<CreateDepartmentDto>) {
    return this.prisma.department.update({ where: { id }, data: dto });
  }

  remove(id: string) {
    return this.prisma.department.delete({ where: { id } });
  }

  async getUserCount(id: string) {
    const department = await this.prisma.department.findUnique({
      where: { id },
      select: { users: true },
    });

    if (!department) throw new NotFoundException('Department not found');
    return { count: department.users.length };
  }

  async transferAndDelete(id: string, destinationDepartmentId: string) {
    // Verify destination department exists
    const destinationDept = await this.prisma.department.findUnique({
      where: { id: destinationDepartmentId },
    });

    if (!destinationDept) throw new NotFoundException('Destination department not found');

    // Update all users from source department to destination department
    await this.prisma.user.updateMany({
      where: { departmentId: id },
      data: { departmentId: destinationDepartmentId },
    });

    // Delete the department
    return this.prisma.department.delete({ where: { id } });
  }
}
