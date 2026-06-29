import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class AuditLogsService {
  constructor(private prisma: PrismaService) {}

  create(data: { performedById: string; action: string; entity: string; entityId: string }) {
    return this.prisma.auditLog.create({ data });
  }

  findAll() {
    return this.prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        performedBy: { select: { id: true, name: true } },
      },
    });
  }
}
