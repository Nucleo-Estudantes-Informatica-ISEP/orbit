import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { requireOwnedAttachments } from '../files/file-access';
import { MailService } from '../mail/mail.service';
import { CreatePlanDto } from './dto/create-plan.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';
import { PlanStatus } from '@prisma/client';

@Injectable()
export class PlansService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
  ) {}

  private readonly include = {
    department: { select: { id: true, name: true } },
    createdBy: { select: { id: true, name: true } },
    approvedBy: { select: { id: true, name: true } },
  };

  async create(dto: CreatePlanDto, actorId: string) {
    const { deadline, ...rest } = dto;
    return this.prisma.$transaction(async (tx) => {
      await requireOwnedAttachments(tx, actorId, [dto.fileKey]);
      return tx.plan.create({
        data: {
          ...rest,
          createdById: actorId,
          ...(deadline ? { deadline: new Date(deadline) } : {}),
        },
        include: this.include,
      });
    });
  }

  findAll(status?: string) {
    return this.prisma.plan.findMany({
      where: status ? { status: status as PlanStatus } : undefined,
      orderBy: { createdAt: 'desc' },
      include: this.include,
    });
  }

  async findOne(id: string) {
    const plan = await this.prisma.plan.findUnique({
      where: { id },
      include: this.include,
    });
    if (!plan) throw new NotFoundException('Plano não encontrado');
    return plan;
  }

  async update(id: string, dto: UpdatePlanDto, actorId: string) {
    const { deadline, ...rest } = dto;
    return this.prisma.$transaction(async (tx) => {
      if (dto.fileKey !== undefined) {
        const previous = await tx.plan.findUnique({
          where: { id },
          select: { fileKey: true },
        });
        await requireOwnedAttachments(
          tx,
          actorId,
          [dto.fileKey],
          [previous?.fileKey],
        );
      }
      return tx.plan.update({
        where: { id },
        data: {
          ...rest,
          ...(deadline ? { deadline: new Date(deadline) } : {}),
        },
        include: this.include,
      });
    });
  }

  async approve(id: string, approvedById: string) {
    const plan = await this.prisma.plan.findUnique({ where: { id } });
    if (!plan) throw new NotFoundException('Plano não encontrado');
    if (plan.status !== 'PENDING') {
      throw new BadRequestException(
        'Apenas planos em estado PENDING podem ser aprovados',
      );
    }
    const result = await this.prisma.plan.update({
      where: { id },
      data: { status: 'APPROVED', approvedById, approvedAt: new Date() },
      include: this.include,
    });
    this.notifyPlanCreator(plan.createdById, plan.name, 'APPROVED').catch(
      () => {},
    );
    return result;
  }

  async reject(id: string, approvedById: string, rejectionNote?: string) {
    const plan = await this.prisma.plan.findUnique({ where: { id } });
    if (!plan) throw new NotFoundException('Plano não encontrado');
    if (plan.status !== 'PENDING') {
      throw new BadRequestException(
        'Apenas planos em estado PENDING podem ser rejeitados',
      );
    }
    const result = await this.prisma.plan.update({
      where: { id },
      data: {
        status: 'REJECTED',
        approvedById,
        approvedAt: new Date(),
        rejectionNote: rejectionNote ?? null,
      },
      include: this.include,
    });
    this.notifyPlanCreator(
      plan.createdById,
      plan.name,
      'REJECTED',
      rejectionNote,
    ).catch(() => {});
    return result;
  }

  async remove(id: string) {
    const plan = await this.prisma.plan.findUnique({ where: { id } });
    if (!plan) throw new NotFoundException('Plano não encontrado');
    return this.prisma.plan.delete({ where: { id } });
  }

  private async notifyPlanCreator(
    userId: string,
    planTitle: string,
    status: string,
    rejectionNote?: string,
  ) {
    const settings = await this.prisma.userSettings.findUnique({
      where: { userId },
      include: { user: { select: { name: true, email: true } } },
    });
    if (settings?.emailNotifications && settings.user.email) {
      await this.mailService.sendPlanStatusUpdate(
        settings.user.email,
        settings.user.name,
        planTitle,
        status,
        rejectionNote,
      );
    }
  }
}
