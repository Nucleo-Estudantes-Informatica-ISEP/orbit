import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { requireOwnedAttachments } from '../files/file-access';
import { DebtStatus, DebtType, type Prisma } from '@prisma/client';

export type CreateDebtInput = Omit<
  Prisma.DebtUncheckedCreateInput,
  'occurredAt' | 'status' | 'completedAt' | 'fileKeys' | 'createdById'
> & {
  createdById: string;
  occurredAt?: Date | string;
  fileKeys?: string[];
};

export type UpdateDebtInput = Omit<
  Prisma.DebtUncheckedUpdateInput,
  'occurredAt' | 'status' | 'completedAt' | 'fileKeys'
> & {
  occurredAt?: Date | string;
  fileKeys?: string[];
  status?: DebtStatus;
  completedAt?: Date | null;
};

@Injectable()
export class DebtsService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly include = {
    createdBy: { select: { id: true, name: true } },
  };

  create(data: CreateDebtInput) {
    const rest = data;
    if (
      rest.occurredAt &&
      typeof rest.occurredAt === 'string' &&
      rest.occurredAt.length === 10
    ) {
      rest.occurredAt = new Date(rest.occurredAt);
    }
    return this.prisma.$transaction(async (tx) => {
      await requireOwnedAttachments(tx, data.createdById, data.fileKeys ?? []);
      return tx.debt.create({
        data: {
          ...rest,
          status: 'PENDING',
          completedAt: null,
        },
        include: this.include,
      });
    });
  }

  findAll(type?: string) {
    return this.prisma.debt.findMany({
      where: type ? { type: type as DebtType } : undefined,
      orderBy: { createdAt: 'desc' },
      include: this.include,
    });
  }

  async findOne(id: string) {
    const d = await this.prisma.debt.findUnique({
      where: { id },
      include: this.include,
    });
    if (!d) throw new NotFoundException('Dívida não encontrada');
    return d;
  }

  async update(id: string, data: UpdateDebtInput, actorId: string) {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.debt.findUnique({ where: { id } });
      if (!existing) throw new NotFoundException('Dívida não encontrada');
      if (existing.status === 'COMPLETED') {
        throw new BadRequestException(
          'Não é possível editar uma dívida concluída',
        );
      }
      await requireOwnedAttachments(
        tx,
        actorId,
        data.fileKeys ?? [],
        existing.fileKeys,
      );
      const rest = data;
      if (
        rest.occurredAt &&
        typeof rest.occurredAt === 'string' &&
        rest.occurredAt.length === 10
      ) {
        rest.occurredAt = new Date(rest.occurredAt);
      }
      const nextStatus = rest.status;
      return tx.debt.update({
        where: { id },
        data: {
          ...rest,
          ...(nextStatus === 'COMPLETED'
            ? { completedAt: rest.completedAt ?? new Date() }
            : nextStatus === 'PENDING'
              ? { completedAt: null }
              : {}),
        },
        include: this.include,
      });
    });
  }

  async complete(id: string) {
    const d = await this.prisma.debt.findUnique({ where: { id } });
    if (!d) throw new NotFoundException('Dívida não encontrada');
    if (d.status === 'COMPLETED') {
      return this.prisma.debt.findUnique({
        where: { id },
        include: this.include,
      });
    }
    return this.prisma.debt.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
      },
      include: this.include,
    });
  }

  async revert(id: string) {
    const d = await this.prisma.debt.findUnique({ where: { id } });
    if (!d) throw new NotFoundException('Dívida não encontrada');
    if (d.status !== 'COMPLETED') {
      throw new BadRequestException(
        'Apenas dívidas concluídas podem ser revertidas',
      );
    }
    return this.prisma.debt.update({
      where: { id },
      data: {
        status: 'PENDING',
        completedAt: null,
      },
      include: this.include,
    });
  }

  async remove(id: string) {
    const d = await this.prisma.debt.findUnique({ where: { id } });
    if (!d) throw new NotFoundException('Dívida não encontrada');
    if (d.status === 'COMPLETED') {
      throw new BadRequestException(
        'Não é possível eliminar uma dívida concluída',
      );
    }
    return this.prisma.debt.delete({ where: { id } });
  }
}
