import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateEventDto } from './dto/create-event.dto';
import { AnnouncementsService } from '../announcements/announcements.service';
import type { Prisma } from '@prisma/client';

@Injectable()
export class EventsService {
  constructor(
    private prisma: PrismaService,
    private announcements: AnnouncementsService,
  ) {}

  private readonly include = {
    eventDepartments: {
      include: { department: { select: { id: true, name: true } } },
    },
  };

  private parseDate(value?: string) {
    if (!value) {
      return undefined;
    }

    const parsed = new Date(value);

    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException('Invalid date format');
    }

    return parsed.toISOString();
  }

  create(data: CreateEventDto) {
    const {
      departmentIds,
      performedById,
      start,
      end,
      startDate,
      endDate,
      ...eventData
    } = data;

    const parsedStartDate = this.parseDate(startDate ?? start);
    const parsedEndDate = this.parseDate(endDate ?? end);

    if (!parsedStartDate || !parsedEndDate) {
      throw new BadRequestException('Event start and end dates are required');
    }

    const prismaData: Prisma.EventCreateInput = {
      ...eventData,
      startDate: parsedStartDate,
      endDate: parsedEndDate,
    };

    if (departmentIds && departmentIds.length > 0) {
      prismaData.eventDepartments = {
        create: departmentIds.map((departmentId) => ({
          department: { connect: { id: departmentId } },
        })),
      };
    }

    return this.prisma.event
      .create({
        data: prismaData,
        include: this.include,
      })
      .then((e) => {
        if (departmentIds && departmentIds.length > 0) {
          this.announcements
            .createForDepartmentUsers(
              departmentIds,
              'EVENT_CREATED',
              `Novo evento disponível: ${e.title}.`,
              performedById,
            )
            .catch(() => {});
        }
        // TODO: enviar email quando um evento for criado para os departamentos com acesso.
        return e;
      });
  }

  async findAll(filters?: {
    page?: string;
    pageSize?: string;
    filter?: string;
  }) {
    const page = Math.max(1, Number(filters?.page ?? 1) || 1);
    const pageSize = Math.max(
      1,
      Math.min(100, Number(filters?.pageSize ?? 6) || 6),
    );
    const now = new Date();
    const where: Prisma.EventWhereInput | undefined =
      filters?.filter === 'UPCOMING'
        ? { startDate: { gte: now } }
        : filters?.filter === 'PAST'
          ? { startDate: { lt: now } }
          : undefined;
    const [total, items] = await Promise.all([
      this.prisma.event.count({ where }),
      this.prisma.event.findMany({
        where,
        orderBy: { startDate: 'asc' },
        include: this.include,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    return { items, total, page, pageSize };
  }

  findAllRaw(filter?: string) {
    const now = new Date();
    const where: Prisma.EventWhereInput | undefined =
      filter === 'UPCOMING'
        ? { startDate: { gte: now } }
        : filter === 'PAST'
          ? { startDate: { lt: now } }
          : undefined;
    return this.prisma.event.findMany({
      where,
      orderBy: { startDate: 'asc' },
      include: this.include,
    });
  }

  async findOne(id: string) {
    const e = await this.prisma.event.findUnique({
      where: { id },
      include: this.include,
    });
    if (!e) throw new NotFoundException('Event not found');
    return e;
  }

  async update(id: string, data: Partial<CreateEventDto>) {
    const {
      performedById,
      departmentIds,
      start,
      end,
      startDate,
      endDate,
      ...updateData
    } = data;
    void performedById;
    return this.prisma.$transaction(async (tx) => {
      if (departmentIds !== undefined) {
        await tx.eventDepartment.deleteMany({ where: { eventId: id } });
      }
      return tx.event.update({
        where: { id },
        data: {
          ...updateData,
          ...(startDate !== undefined || start !== undefined
            ? { startDate: this.parseDate(startDate ?? start) }
            : {}),
          ...(endDate !== undefined || end !== undefined
            ? { endDate: this.parseDate(endDate ?? end) }
            : {}),
          ...(Array.isArray(departmentIds) && departmentIds.length > 0
            ? {
                eventDepartments: {
                  create: departmentIds.map((deptId: string) => ({
                    department: { connect: { id: deptId } },
                  })),
                },
              }
            : {}),
        },
        include: this.include,
      });
    });
  }

  remove(id: string) {
    return this.prisma.event.delete({ where: { id } });
  }
}
