import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { Permissions } from '../auth/permissions.decorator';
import { DebtsService } from './debts.service';
import { ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CreateDebtDto, DebtQueryDto, IdParamDto, UpdateDebtDto } from '../contracts/request.dto';
import { DebtResponseDto } from '../contracts/response.dto';
import { ApiProtectedController } from '../contracts/openapi.decorators';

@ApiTags('debts')
@ApiProtectedController()
@Controller('debts')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class DebtsController {
  constructor(private readonly svc: DebtsService) {}

  @Post()
  @Permissions('DEBTS_CREATE')
  @ApiCreatedResponse({ type: DebtResponseDto })
  create(@Body() body: CreateDebtDto) {
    return this.svc.create(body);
  }

  @Get()
  @Permissions('DEBTS_READ')
  @ApiOkResponse({ type: DebtResponseDto, isArray: true })
  findAll(@Query() query: DebtQueryDto) {
    return this.svc.findAll(query.type);
  }

  @Get(':id')
  @Permissions('DEBTS_READ')
  @ApiOkResponse({ type: DebtResponseDto })
  findOne(@Param() params: IdParamDto) {
    return this.svc.findOne(params.id);
  }

  @Post(':id/complete')
  @Permissions('DEBTS_UPDATE')
  @ApiCreatedResponse({ type: DebtResponseDto })
  complete(@Param() params: IdParamDto) {
    return this.svc.complete(params.id);
  }

  @Post(':id/revert')
  @Permissions('DEBTS_UPDATE')
  @ApiCreatedResponse({ type: DebtResponseDto })
  revert(@Param() params: IdParamDto) {
    return this.svc.revert(params.id);
  }

  @Put(':id')
  @Permissions('DEBTS_UPDATE')
  @ApiOkResponse({ type: DebtResponseDto })
  update(@Param() params: IdParamDto, @Body() body: UpdateDebtDto) {
    return this.svc.update(params.id, body);
  }

  @Delete(':id')
  @Permissions('DEBTS_DELETE')
  @ApiOkResponse({ type: DebtResponseDto })
  remove(@Param() params: IdParamDto) {
    return this.svc.remove(params.id);
  }
}
