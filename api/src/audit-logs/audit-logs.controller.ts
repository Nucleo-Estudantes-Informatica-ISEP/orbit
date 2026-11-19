import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuditLogsService } from './audit-logs.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { Permissions } from '../auth/permissions.decorator';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { AuditLogResponseDto } from '../contracts/response.dto';
import { ApiProtectedController } from '../contracts/openapi.decorators';

@ApiTags('audit-logs')
@ApiProtectedController()
@Controller('audit-logs')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AuditLogsController {
  constructor(private svc: AuditLogsService) {}

  @Get()
  @Permissions('AUDITS_READ')
  @ApiOkResponse({ type: AuditLogResponseDto, isArray: true })
  findAll() {
    return this.svc.findAll();
  }
}
