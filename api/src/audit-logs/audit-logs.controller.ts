import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { AuditLogsService } from './audit-logs.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { Permissions } from '../auth/permissions.decorator';

@Controller('audit-logs')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AuditLogsController {
  constructor(private svc: AuditLogsService) {}

  @Post()
  @Permissions('USERS_CREATE')
  create(@Body() body: any) {
    return this.svc.create(body);
  }

  @Get()
  @Permissions('USERS_READ')
  findAll() {
    return this.svc.findAll();
  }
}
