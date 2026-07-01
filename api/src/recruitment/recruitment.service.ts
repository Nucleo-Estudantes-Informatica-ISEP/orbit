import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class RecruitmentService {
  constructor(private prisma: PrismaService) {}

  private include = {
    departmentChoices: {
      include: { department: true },
      orderBy: { priority: 'asc' as const },
    },
  };

  create(data: any) {
    const { performedById, departmentChoices, ...createData } = data;
    return this.prisma.candidate.create({
      data: {
        ...createData,
        departmentChoices: departmentChoices?.length
          ? { create: departmentChoices.map((dc: { departmentId: string; priority: number }) => ({ departmentId: dc.departmentId, priority: dc.priority })) }
          : undefined,
      },
      include: this.include,
    });
  }

  findAll() {
    return this.prisma.candidate.findMany({ include: this.include });
  }

  async findOne(id: string) {
    const c = await this.prisma.candidate.findUnique({ where: { id }, include: this.include });
    if (!c) throw new NotFoundException('Candidate not found');
    return c;
  }

  async update(id: string, data: any) {
    const { performedById, departmentChoices, ...updateData } = data;
    if (departmentChoices) {
      await this.prisma.candidateDepartmentChoice.deleteMany({ where: { candidateId: id } });
      if (departmentChoices.length) {
        await this.prisma.candidateDepartmentChoice.createMany({
          data: departmentChoices.map((dc: { departmentId: string; priority: number }) => ({ candidateId: id, departmentId: dc.departmentId, priority: dc.priority })),
        });
      }
    }
    return this.prisma.candidate.update({
      where: { id },
      data: updateData,
      include: this.include,
    });
  }

  remove(id: string) {
    return this.prisma.candidate.delete({ where: { id } });
  }
}
