import { Module } from '@nestjs/common';
import { AuditLogsService } from './audit-logs.service';
import { AuditLogsController } from './audit-logs.controller';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [AuditLogsController],
  providers: [AuditLogsService, PrismaService],
})
export class AuditLogsModule {}
