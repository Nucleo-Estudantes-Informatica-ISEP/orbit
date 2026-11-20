import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import {
  attachmentKey,
  requireOwnedAttachments,
  safeStoredAttachment,
} from '../files/file-access';
import { CreateResourceDto } from './dto/create-resource.dto';
import { UpdateResourceDto } from './dto/update-resource.dto';

function safeResource<T extends { url: string }>(row: T): T {
  return { ...row, url: safeStoredAttachment(row.url) ?? '' };
}

@Injectable()
export class ResourcesService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly include = {
    resourceDepartments: {
      include: { department: { select: { id: true, name: true } } },
    },
  };

  create(data: CreateResourceDto, actorId: string) {
    const { departmentIds, link, url, ...resourceData } = data;
    const key = attachmentKey(url ?? link);

    return this.prisma.$transaction(async (tx) => {
      await requireOwnedAttachments(tx, actorId, [key]);
      return safeResource(
        await tx.resource.create({
          data: {
            ...resourceData,
            url: key ?? url ?? link ?? '',
            ...(departmentIds && departmentIds.length > 0
              ? {
                  resourceDepartments: {
                    create: departmentIds.map((departmentId) => ({
                      department: { connect: { id: departmentId } },
                    })),
                  },
                }
              : {}),
          },
          include: this.include,
        }),
      );
    });
  }

  async findAll(filters?: {
    page?: number;
    pageSize?: number;
    category?: string;
    search?: string;
  }) {
    const page = Math.max(1, Number(filters?.page ?? 1) || 1);
    const pageSize = Math.max(
      1,
      Math.min(100, Number(filters?.pageSize ?? 6) || 6),
    );
    const where: any = {
      ...(filters?.category && filters.category !== 'ALL'
        ? { category: filters.category }
        : {}),
      ...(filters?.search
        ? {
            OR: [
              { title: { contains: filters.search, mode: 'insensitive' } },
              {
                description: { contains: filters.search, mode: 'insensitive' },
              },
            ],
          }
        : {}),
    };
    const [total, items] = await Promise.all([
      this.prisma.resource.count({ where }),
      this.prisma.resource.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: this.include,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    return { items: items.map(safeResource), total, page, pageSize };
  }

  async findAllRaw(filters?: { category?: string; search?: string }) {
    const where: any = {};
    if (filters?.category) where.category = filters.category;
    if (filters?.search) {
      where.OR = [
        { title: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
      ];
    }
    const rows = await this.prisma.resource.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(safeResource);
  }

  async findOne(id: string) {
    const r = await this.prisma.resource.findUnique({
      where: { id },
      include: this.include,
    });
    if (!r) throw new NotFoundException('Resource not found');
    return safeResource(r);
  }

  async update(id: string, data: UpdateResourceDto, actorId: string) {
    const { departmentIds, url, link, ...updateData } = data;
    const incomingUrl = url ?? link;
    const key = attachmentKey(incomingUrl);
    return this.prisma.$transaction(async (tx) => {
      if (incomingUrl !== undefined) {
        const previous = await tx.resource.findUnique({
          where: { id },
          select: { url: true },
        });
        await requireOwnedAttachments(
          tx,
          actorId,
          [key],
          [attachmentKey(previous?.url)],
        );
      }
      if (departmentIds !== undefined) {
        await tx.resourceDepartment.deleteMany({ where: { resourceId: id } });
      }
      return safeResource(
        await tx.resource.update({
          where: { id },
          data: {
            ...updateData,
            url: key ?? incomingUrl,
            ...(Array.isArray(departmentIds) && departmentIds.length > 0
              ? {
                  resourceDepartments: {
                    create: departmentIds.map((deptId: string) => ({
                      department: { connect: { id: deptId } },
                    })),
                  },
                }
              : {}),
          },
          include: this.include,
        }),
      );
    });
  }

  async remove(id: string) {
    const r = await this.prisma.resource.findUnique({ where: { id } });
    if (!r) throw new NotFoundException('Resource not found');
    return safeResource(await this.prisma.resource.delete({ where: { id } }));
  }
}
