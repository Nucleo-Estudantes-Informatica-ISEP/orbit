import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { MinioService } from '../files/minio.service';
import { MailService } from '../mail/mail.service';
import { CreatePlanDto } from './dto/create-plan.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';

@Injectable()
export class PlansService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly minio: MinioService,
    private readonly mailService: MailService,
  ) {}

  private readonly include = {
    department: { select: { id: true, name: true } },
    createdBy: { select: { id: true, name: true } },
    approvedBy: { select: { id: true, name: true } },
  };

  async create(dto: CreatePlanDto) {
    const { deadline, ...rest } = dto;
    return this.prisma.plan.create({
      data: {
        ...rest,
        ...(deadline ? { deadline: new Date(deadline) } : {}),
      },
      include: this.include,
    });
  }

  findAll(status?: string) {
    return this.prisma.plan.findMany({
      where: status ? { status: status as any } : undefined,
      orderBy: { createdAt: 'desc' },
      include: this.include,
    });
  }

  async findOne(id: string) {
    const plan = await this.prisma.plan.findUnique({ where: { id }, include: this.include });
    if (!plan) throw new NotFoundException('Plano não encontrado');
    return plan;
  }

  async update(id: string, dto: UpdatePlanDto) {
    const { deadline, ...rest } = dto;
    return this.prisma.plan.update({
      where: { id },
      data: {
        ...rest,
        ...(deadline ? { deadline: new Date(deadline) } : {}),
      },
      include: this.include,
    });
  }

  async approve(id: string, approvedById: string) {
    const plan = await this.prisma.plan.findUnique({ where: { id } });
    if (!plan) throw new NotFoundException('Plano não encontrado');
    if (plan.status !== 'PENDING') {
      throw new BadRequestException('Apenas planos em estado PENDING podem ser aprovados');
    }
    const result = await this.prisma.plan.update({
      where: { id },
      data: { status: 'APPROVED', approvedById, approvedAt: new Date() },
      include: this.include,
    });
    this.notifyPlanCreator(plan.createdById, plan.title, 'APROVADO').catch(() => {});
    return result;
  }

  async reject(id: string, approvedById: string, rejectionNote?: string) {
    const plan = await this.prisma.plan.findUnique({ where: { id } });
    if (!plan) throw new NotFoundException('Plano não encontrado');
    if (plan.status !== 'PENDING') {
      throw new BadRequestException('Apenas planos em estado PENDING podem ser rejeitados');
    }
    const result = await this.prisma.plan.update({
      where: { id },
      data: { status: 'REJECTED', approvedById, approvedAt: new Date(), rejectionNote: rejectionNote ?? null },
      include: this.include,
    });
    this.notifyPlanCreator(plan.createdById, plan.title, 'REJEITADO').catch(() => {});
    return result;
  }

  async remove(id: string) {
    const plan = await this.prisma.plan.findUnique({ where: { id } });
    if (!plan) throw new NotFoundException('Plano não encontrado');
    if (plan.fileKey) {
      await this.minio.deleteObject(plan.fileKey).catch(() => {});
    }
    return this.prisma.plan.delete({ where: { id } });
  }

  private async notifyPlanCreator(userId: string, planTitle: string, status: string) {
    const settings = await this.prisma.userSettings.findUnique({
      where: { userId },
      include: { user: { select: { name: true, email: true } } },
    });
    if (settings?.emailNotifications && settings.user.email) {
      await this.mailService.sendPlanStatusUpdate(settings.user.email, settings.user.name, planTitle, status);
    }
  }
}
