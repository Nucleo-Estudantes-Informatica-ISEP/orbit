import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { MinioService } from '../files/minio.service';
import { CreateResourceDto } from './dto/create-resource.dto';

@Injectable()
export class ResourcesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly minio: MinioService,
  ) {}

  private readonly include = {
    resourceDepartments: { include: { department: { select: { id: true, name: true } } } },
  };

  create(data: CreateResourceDto) {
    const { departmentIds, link, url, ...resourceData } = data;

    return this.prisma.resource.create({
      data: {
        ...resourceData,
        url: url ?? link ?? '',
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
    });
  }

  async findAll(filters?: { page?: string; pageSize?: string; category?: string; search?: string }) {
    const page = Math.max(1, Number(filters?.page ?? 1) || 1);
    const pageSize = Math.max(1, Math.min(100, Number(filters?.pageSize ?? 6) || 6));
    const where: any = {
      ...(filters?.category && filters.category !== 'ALL' ? { category: filters.category } : {}),
      ...(filters?.search ? {
        OR: [
          { title: { contains: filters.search, mode: 'insensitive' } },
          { description: { contains: filters.search, mode: 'insensitive' } },
        ],
      } : {}),
    };
    const [total, items] = await Promise.all([
      this.prisma.resource.count({ where }),
      this.prisma.resource.findMany({ where, orderBy: { createdAt: 'desc' }, include: this.include, skip: (page - 1) * pageSize, take: pageSize }),
    ]);
    return { items, total, page, pageSize };
  }

  findAllRaw(filters?: { category?: string; search?: string }) {
    const where: any = {};
    if (filters?.category) where.category = filters.category;
    if (filters?.search) {
      where.OR = [
        { title: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
      ];
    }
    return this.prisma.resource.findMany({ where, orderBy: { createdAt: 'desc' } });
  }

  async findOne(id: string) {
    const r = await this.prisma.resource.findUnique({ where: { id }, include: this.include });
    if (!r) throw new NotFoundException('Resource not found');
    return r;
  }

  async update(id: string, data: any) {
    const { performedById, departmentIds, ...updateData } = data;
    return this.prisma.$transaction(async (tx) => {
      if (departmentIds !== undefined) {
        await tx.resourceDepartment.deleteMany({ where: { resourceId: id } });
      }
      return tx.resource.update({
        where: { id },
        data: {
          ...updateData,
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
      });
    });
  }

  async remove(id: string) {
    const r = await this.prisma.resource.findUnique({ where: { id } });
    if (!r) throw new NotFoundException('Resource not found');
    const key = this.minio.extractKey(r.url);
    if (key) {
      await this.minio.deleteObject(key).catch(() => {});
    }
    return this.prisma.resource.delete({ where: { id } });
  }
}
