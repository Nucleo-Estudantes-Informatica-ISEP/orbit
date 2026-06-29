import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { MinioService } from '../files/minio.service';

@Injectable()
export class DebtsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly minio: MinioService,
  ) {}

  private readonly include = {
    createdBy: { select: { id: true, name: true } },
  };

  create(data: any) {
    const { performedById, ...rest } = data;
    if (rest.occurredAt && typeof rest.occurredAt === 'string' && rest.occurredAt.length === 10) {
      rest.occurredAt = new Date(rest.occurredAt).toISOString();
    }
    return this.prisma.debt.create({
      data: {
        ...rest,
        status: 'PENDING',
        completedAt: null,
      },
      include: this.include,
    });
  }

  findAll(type?: string) {
    return this.prisma.debt.findMany({
      where: type ? { type: type as any } : undefined,
      orderBy: { createdAt: 'desc' },
      include: this.include,
    });
  }

  async findOne(id: string) {
    const d = await this.prisma.debt.findUnique({ where: { id }, include: this.include });
    if (!d) throw new NotFoundException('Dívida não encontrada');
    return d;
  }

  async update(id: string, data: any) {
    const { performedById, ...rest } = data;
    if (rest.occurredAt && typeof rest.occurredAt === 'string' && rest.occurredAt.length === 10) {
      rest.occurredAt = new Date(rest.occurredAt).toISOString();
    }
    const nextStatus = rest.status;
    return this.prisma.debt.update({
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
  }

  async complete(id: string) {
    const d = await this.prisma.debt.findUnique({ where: { id } });
    if (!d) throw new NotFoundException('Dívida não encontrada');
    if (d.status === 'COMPLETED') {
      return this.prisma.debt.findUnique({ where: { id }, include: this.include });
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

  async remove(id: string) {
    const d = await this.prisma.debt.findUnique({ where: { id } });
    if (!d) throw new NotFoundException('Dívida não encontrada');
    if (d.fileKeys?.length) {
      await Promise.all(d.fileKeys.map((key: string) => this.minio.deleteObject(key).catch(() => {})));
    }
    return this.prisma.debt.delete({ where: { id } });
  }
}
