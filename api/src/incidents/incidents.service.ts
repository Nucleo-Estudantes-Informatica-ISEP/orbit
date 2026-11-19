import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { requireOwnedAttachments } from '../files/file-access';
import type { Prisma } from '@prisma/client';

export type CreateIncidentInput = Omit<
  Prisma.IncidentUncheckedCreateInput,
  'occurredAt' | 'createdById' | 'fileKeys'
> & {
  occurredAt?: Date | string;
  fileKeys?: string[];
};

export type UpdateIncidentInput = Omit<
  Prisma.IncidentUncheckedUpdateInput,
  'occurredAt' | 'createdById' | 'fileKeys'
> & {
  occurredAt?: Date | string;
  fileKeys?: string[];
};

export interface CreateIncidentCommentInput {
  content: string;
}

@Injectable()
export class IncidentsService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly include = {
    createdBy: { select: { id: true, name: true } },
    department: { select: { id: true, name: true } },
    comments: {
      include: { createdBy: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'asc' as const },
    },
  };

  create(data: CreateIncidentInput, actorId: string) {
    const rest = data;
    if (
      rest.occurredAt &&
      typeof rest.occurredAt === 'string' &&
      rest.occurredAt.length === 10
    ) {
      rest.occurredAt = new Date(rest.occurredAt);
    }
    return this.prisma.$transaction(async (tx) => {
      await requireOwnedAttachments(tx, actorId, data.fileKeys ?? []);
      return tx.incident.create({
        data: { ...rest, createdById: actorId },
        include: this.include,
      });
    });
  }

  findAll(departmentId?: string) {
    return this.prisma.incident.findMany({
      where: departmentId ? { departmentId } : undefined,
      orderBy: { createdAt: 'desc' },
      include: this.include,
    });
  }

  async findOne(id: string) {
    const d = await this.prisma.incident.findUnique({
      where: { id },
      include: this.include,
    });
    if (!d) throw new NotFoundException('Incidente não encontrado');
    return d;
  }

  async update(id: string, data: UpdateIncidentInput, actorId: string) {
    const rest = data;
    if (
      rest.occurredAt &&
      typeof rest.occurredAt === 'string' &&
      rest.occurredAt.length === 10
    ) {
      rest.occurredAt = new Date(rest.occurredAt);
    }
    return this.prisma.$transaction(async (tx) => {
      if (data.fileKeys !== undefined) {
        const previous = await tx.incident.findUnique({
          where: { id },
          select: { fileKeys: true },
        });
        await requireOwnedAttachments(
          tx,
          actorId,
          data.fileKeys ?? [],
          previous?.fileKeys ?? [],
        );
      }
      return tx.incident.update({
        where: { id },
        data: { ...rest },
        include: this.include,
      });
    });
  }

  async addComment(
    incidentId: string,
    data: CreateIncidentCommentInput,
    actorId: string,
  ) {
    const { content } = data;
    await this.prisma.incidentComment.create({
      data: { incidentId, content, createdById: actorId },
    });
    return this.prisma.incident.findUnique({
      where: { id: incidentId },
      include: this.include,
    });
  }

  async removeComment(commentId: string) {
    const c = await this.prisma.incidentComment.findUnique({
      where: { id: commentId },
    });
    if (!c) throw new NotFoundException('Comentário não encontrado');
    return this.prisma.incidentComment.delete({ where: { id: commentId } });
  }

  async remove(id: string) {
    const d = await this.prisma.incident.findUnique({ where: { id } });
    if (!d) throw new NotFoundException('Incidente não encontrado');
    return this.prisma.incident.delete({ where: { id } });
  }
}
