import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
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

  async remove(id: string) {
    const [userCount, projectCount, choiceCount, planCount, itemCount] =
      await Promise.all([
        this.prisma.user.count({ where: { departmentId: id } }),
        this.prisma.project.count({ where: { departmentId: id } }),
        this.prisma.candidateDepartmentChoice.count({
          where: { departmentId: id },
        }),
        this.prisma.plan.count({ where: { departmentId: id } }),
        this.prisma.inventoryItem.count({ where: { departmentId: id } }),
      ]);

    if (
      userCount > 0 ||
      projectCount > 0 ||
      choiceCount > 0 ||
      planCount > 0 ||
      itemCount > 0
    ) {
      throw new ConflictException(
        'Departamento tem registos associados. Usa a opção de transferência para eliminar.',
      );
    }

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

    if (!destinationDept)
      throw new NotFoundException('Destination department not found');

    await this.prisma.$transaction([
      this.prisma.user.updateMany({
        where: { departmentId: id },
        data: { departmentId: destinationDepartmentId },
      }),
      this.prisma.project.updateMany({
        where: { departmentId: id },
        data: { departmentId: destinationDepartmentId },
      }),
      this.prisma.candidateDepartmentChoice.updateMany({
        where: { departmentId: id },
        data: { departmentId: destinationDepartmentId },
      }),
      this.prisma.plan.updateMany({
        where: { departmentId: id },
        data: { departmentId: destinationDepartmentId },
      }),
      this.prisma.inventoryItem.updateMany({
        where: { departmentId: id },
        data: { departmentId: destinationDepartmentId },
      }),
      this.prisma.department.delete({ where: { id } }),
    ]);

    return { message: 'Department deleted successfully' };
  }
}
