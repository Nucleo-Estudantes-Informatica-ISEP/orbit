import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { AnnouncementsService } from '../announcements/announcements.service';
import type { ProjectStatus } from '@prisma/client';

export interface ProjectInput {
  departmentId: string;
  name: string;
  description?: string;
  status?: ProjectStatus;
  deadline?: Date | string;
  performedById?: string;
}

@Injectable()
export class ProjectsService {
  constructor(
    private prisma: PrismaService,
    private announcements: AnnouncementsService,
  ) {}

  create(data: ProjectInput) {
    const { performedById, ...createData } = data;
    if (createData.deadline && typeof createData.deadline === 'string') {
      createData.deadline = new Date(createData.deadline);
    }
    return this.prisma.project
      .create({
        data: createData,
        include: this.include,
      })
      .then((p) => {
        this.announcements
          .createForDepartmentUsers(
            [p.departmentId],
            'PROJECT_CREATED',
            `Novo projeto criado: ${p.name}.`,
            performedById,
          )
          .catch(() => {});
        // TODO: enviar email quando um projeto for criado para o departamento correspondente.
        return p;
      });
  }

  private readonly include = {
    department: { select: { id: true, name: true } },
    projectMembers: {
      include: { user: { select: { id: true, name: true, email: true } } },
    },
    tasks: { select: { id: true, title: true, status: true, priority: true } },
  };

  findAll() {
    return this.prisma.project.findMany({
      include: this.include,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const p = await this.prisma.project.findUnique({
      where: { id },
      include: this.include,
    });
    if (!p) throw new NotFoundException('Project not found');
    return p;
  }

  update(id: string, data: Partial<ProjectInput>) {
    const { performedById, ...updateData } = data;
    void performedById;
    if (updateData.deadline && typeof updateData.deadline === 'string') {
      updateData.deadline = new Date(updateData.deadline);
    }
    return this.prisma.project.update({
      where: { id },
      data: updateData,
      include: this.include,
    });
  }

  remove(id: string) {
    return this.prisma.project.delete({ where: { id } });
  }

  addMember(projectId: string, userId: string) {
    return this.prisma.projectMember.create({ data: { projectId, userId } });
  }

  removeMember(projectId: string, userId: string) {
    return this.prisma.projectMember.delete({
      where: { projectId_userId: { projectId, userId } },
    });
  }
}
