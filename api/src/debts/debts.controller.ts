import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { Permissions } from '../auth/permissions.decorator';
import {
  DebtsService,
  type CreateDebtInput,
  type UpdateDebtInput,
} from './debts.service';

@Controller('debts')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class DebtsController {
  constructor(private readonly svc: DebtsService) {}

  @Post()
  @Permissions('DEBTS_CREATE')
  create(@Body() body: CreateDebtInput) {
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

  @Post(':id/revert')
  @Permissions('DEBTS_UPDATE')
  revert(@Param('id') id: string) {
    return this.svc.revert(id);
  }

  @Put(':id')
  @Permissions('DEBTS_UPDATE')
  update(@Param('id') id: string, @Body() body: UpdateDebtInput) {
    return this.svc.update(id, body);
  }

  @Delete(':id')
  @Permissions('DEBTS_DELETE')
  remove(@Param('id') id: string) {
    return this.svc.remove(id);
  }
}
