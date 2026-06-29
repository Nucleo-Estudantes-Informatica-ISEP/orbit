import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class BoardsService {
  constructor(private prisma: PrismaService) {}

  create(data: { name: string; description?: string; departmentIds?: string[] }) {
    const { departmentIds, performedById, ...boardData } = data as any;

    return this.prisma.board.create({
      data: {
        ...boardData,
        ...(departmentIds !== undefined
          ? {
              boardDepartments: {
                create: departmentIds.map((departmentId) => ({
                  department: { connect: { id: departmentId } },
                })),
              },
            }
          : {}),
      },
    }).then((b) => {
      if (performedById) {
        this.prisma.auditLog.create({
          data: {
            performedById,
            action: 'CREATE_BOARD',
            entity: 'Board',
            entityId: b.id,
          },
        }).catch(() => {});
      }
      return b;
    });
  }

  findAll() {
    return this.prisma.board.findMany({
      include: { boardDepartments: { include: { department: { select: { id: true, name: true } } } } },
    });
  }

  async findOne(id: string) {
    const b = await this.prisma.board.findUnique({
      where: { id },
      include: {
        boardDepartments: { include: { department: { select: { id: true, name: true } } } },
        tasks: {
          include: { taskAssignees: { include: { user: { select: { id: true, name: true, email: true } } } } },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!b) throw new NotFoundException('Board not found');
    return b;
  }

  update(id: string, data: Partial<{ name: string; description?: string; departmentIds?: string[] }>) {
    const { departmentIds, performedById, ...boardData } = data as any;

    return this.prisma.board.update({
      where: { id },
      data: {
        ...boardData,
        ...(departmentIds !== undefined
          ? {
              boardDepartments: {
                deleteMany: {},
                create: departmentIds.map((departmentId) => ({
                  department: { connect: { id: departmentId } },
                })),
              },
            }
          : {}),
      },
    }).then((b) => {
      if (performedById) {
        this.prisma.auditLog.create({
          data: {
            performedById,
            action: 'UPDATE_BOARD',
            entity: 'Board',
            entityId: b.id,
          },
        }).catch(() => {});
      }
      return b;
    });
  }

  remove(id: string) {
    return this.prisma.board.delete({ where: { id } });
  }
}
