import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { AuditLogsService } from './audit-logs.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { Permissions } from '../auth/permissions.decorator';
import { ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CreateAuditLogDto } from '../contracts/request.dto';
import { AuditLogResponseDto } from '../contracts/response.dto';
import { ApiProtectedController } from '../contracts/openapi.decorators';

@ApiTags('audit-logs')
@ApiProtectedController()
@Controller('audit-logs')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AuditLogsController {
  constructor(private svc: AuditLogsService) {}

  @Post()
  @Permissions('USERS_CREATE')
  @ApiCreatedResponse({ type: AuditLogResponseDto })
  create(@Body() body: CreateAuditLogDto) {
    return this.svc.create(body);
  }

  @Get()
  @Permissions('AUDITS_READ')
  @ApiOkResponse({ type: AuditLogResponseDto, isArray: true })
  findAll() {
    return this.svc.findAll();
  }
}
