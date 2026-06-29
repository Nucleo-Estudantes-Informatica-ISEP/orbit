import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { Priority, TaskStatus } from '@prisma/client';
import { AnnouncementsService } from '../announcements/announcements.service';

@Injectable()
export class TasksService {
  constructor(
    private prisma: PrismaService,
    private announcements: AnnouncementsService,
  ) {}

  private readonly include = {
    taskAssignees: { include: { user: { select: { id: true, name: true, email: true } } } },
    board: { select: { id: true, name: true } },
    project: { select: { id: true, name: true } },
  };

  private normalizeOptionalId(value?: string) {
    const trimmed = value?.trim();
    return trimmed ? trimmed : undefined;
  }

  private async assertRelationsExist(boardId?: string, projectId?: string) {
    const normalizedBoardId = this.normalizeOptionalId(boardId);
    const normalizedProjectId = this.normalizeOptionalId(projectId);

    const [board, project] = await Promise.all([
      normalizedBoardId ? this.prisma.board.findUnique({ where: { id: normalizedBoardId }, select: { id: true } }) : Promise.resolve(null),
      normalizedProjectId ? this.prisma.project.findUnique({ where: { id: normalizedProjectId }, select: { id: true } }) : Promise.resolve(null),
    ]);

    if (normalizedBoardId && !board) {
      throw new NotFoundException('Board not found');
    }

    if (normalizedProjectId && !project) {
      throw new NotFoundException('Project not found');
    }

    return {
      boardId: normalizedBoardId,
      projectId: normalizedProjectId,
    };
  }

  async create(data: { title: string; description?: string; deadline?: Date | string; priority?: Priority; status?: TaskStatus; boardId?: string; projectId?: string; assigneeIds?: string[] }) {
    const { performedById, assigneeIds, deadline, ...taskData } = data as any;
    const relations = await this.assertRelationsExist(taskData.boardId, taskData.projectId);
    const normalizedAssigneeIds: string[] = Array.isArray(assigneeIds)
      ? [...new Set(assigneeIds.filter((userId: string | undefined | null): userId is string => Boolean(userId)))]
      : [];
    return this.prisma.task.create({
      data: {
        ...taskData,
        ...relations,
        ...(deadline ? { deadline: new Date(deadline) } : {}),
        ...(assigneeIds?.length ? {
          taskAssignees: { create: normalizedAssigneeIds.map((userId: string) => ({ user: { connect: { id: userId } } })) },
        } : {}),
      },
      include: this.include,
    }).then((t) => {
      if (performedById) {
        this.prisma.auditLog.create({
          data: { performedById, action: 'CREATE_TASK', entity: 'Task', entityId: t.id },
        }).catch(() => {});
      }
      if (normalizedAssigneeIds.length > 0) {
        this.announcements.createManyForUsers(
          normalizedAssigneeIds,
          'TASK_ASSIGNED',
          `A task "${t.title}" foi atribuida a ti.`,
          performedById,
        ).catch(() => {});
      }
      // TODO: enviar email quando uma task for atribuida a um utilizador.
      return t;
    });
  }

  findAll(filters?: { boardId?: string; projectId?: string; assigneeId?: string; status?: string }) {
    const where: any = {};
    if (filters?.boardId) where.boardId = filters.boardId;
    if (filters?.projectId) where.projectId = filters.projectId;
    if (filters?.status) where.status = filters.status as TaskStatus;
    if (filters?.assigneeId) where.taskAssignees = { some: { userId: filters.assigneeId } };
    return this.prisma.task.findMany({ where, include: this.include, orderBy: { createdAt: 'desc' } });
  }

  async findOne(id: string) {
    const t = await this.prisma.task.findUnique({ where: { id }, include: this.include });
    if (!t) throw new NotFoundException('Task not found');
    return t;
  }

  async update(id: string, data: any) {
    const { performedById, assigneeIds, deadline, ...taskData } = data as any;
    const relations = await this.assertRelationsExist(taskData.boardId, taskData.projectId);
    const currentTask = assigneeIds !== undefined ? await this.prisma.task.findUnique({
      where: { id },
      select: { title: true, taskAssignees: { select: { userId: true } } },
    }) : null;
    const previousAssigneeIds: string[] = currentTask?.taskAssignees.map((assignee) => assignee.userId) ?? [];
    const nextAssigneeIds: string[] = assigneeIds !== undefined
      ? [...new Set((assigneeIds as Array<string | undefined | null>).filter((userId): userId is string => Boolean(userId)))]
      : [];
    return this.prisma.task.update({
      where: { id },
      data: {
        ...taskData,
        ...relations,
        ...(deadline !== undefined ? { deadline: deadline ? new Date(deadline) : null } : {}),
        ...(assigneeIds !== undefined ? {
          taskAssignees: {
            deleteMany: {},
            create: nextAssigneeIds.map((userId: string) => ({ user: { connect: { id: userId } } })),
          },
        } : {}),
      },
      include: this.include,
    }).then((t) => {
      if (performedById) {
        this.prisma.auditLog.create({
          data: { performedById, action: 'UPDATE_TASK', entity: 'Task', entityId: t.id },
        }).catch(() => {});
      }
      if (assigneeIds !== undefined) {
        const newlyAssignedUserIds: string[] = nextAssigneeIds.filter((userId) => !previousAssigneeIds.includes(userId));
        if (newlyAssignedUserIds.length > 0) {
          this.announcements.createManyForUsers(
            newlyAssignedUserIds,
            'TASK_ASSIGNED',
            `A task "${t.title}" foi atribuida a ti.`,
            performedById,
          ).catch(() => {});
        }
        // TODO: enviar email quando uma task for atribuida ou reatribuida a um utilizador.
      }
      return t;
    });
  }

  remove(id: string) {
    return this.prisma.task.delete({ where: { id } });
  }
}
