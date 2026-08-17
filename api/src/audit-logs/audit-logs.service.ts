import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

export interface CreateAuditLogInput {
  performedById: string;
  action: string;
  entity: string;
  entityId: string;
}

@Injectable()
export class AuditLogsService {
  constructor(private prisma: PrismaService) {}

  create(data: CreateAuditLogInput) {
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
