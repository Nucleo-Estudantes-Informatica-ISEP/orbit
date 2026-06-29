import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { Permissions } from '../auth/permissions.decorator';
import { DebtsService } from './debts.service';

@Controller('debts')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class DebtsController {
  constructor(private readonly svc: DebtsService) {}

  @Post()
  @Permissions('DEBTS_CREATE')
  create(@Body() body: any) {
    return this.svc.create(body);
  }

  @Get()
  @Permissions('DEBTS_READ')
  findAll(@Query('type') type?: string) {
    return this.svc.findAll(type);
  }

  @Get(':id')
  @Permissions('DEBTS_READ')
  findOne(@Param('id') id: string) {
    return this.svc.findOne(id);
  }

  @Post(':id/complete')
  @Permissions('DEBTS_UPDATE')
  complete(@Param('id') id: string) {
    return this.svc.complete(id);
  }

  @Put(':id')
  @Permissions('DEBTS_UPDATE')
  update(@Param('id') id: string, @Body() body: any) {
    return this.svc.update(id, body);
  }

  @Delete(':id')
  @Permissions('DEBTS_DELETE')
  remove(@Param('id') id: string) {
    return this.svc.remove(id);
  }
}
