import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { Permissions } from '../auth/permissions.decorator';
import { PlansService } from './plans.service';
import { CreatePlanDto } from './dto/create-plan.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';
import { ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import {
  IdParamDto,
  PlanDecisionDto,
  PlanQueryDto,
} from '../contracts/request.dto';
import { PlanResponseDto } from '../contracts/response.dto';
import { ApiProtectedController } from '../contracts/openapi.decorators';
import type { AuthenticatedRequest } from '../auth/authenticated-request';

@ApiTags('plans')
@ApiProtectedController()
@Controller('plans')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PlansController {
  constructor(private readonly svc: PlansService) {}

  @Post()
  @Permissions('PLANS_CREATE')
  @ApiCreatedResponse({ type: PlanResponseDto })
  create(@Request() request: AuthenticatedRequest, @Body() dto: CreatePlanDto) {
    return this.svc.create(dto, request.user.userId);
  }

  @Get()
  @Permissions('PLANS_READ')
  @ApiOkResponse({ type: PlanResponseDto, isArray: true })
  findAll(@Query() query: PlanQueryDto) {
    return this.svc.findAll(query.status);
  }

  @Get(':id')
  @Permissions('PLANS_READ')
  @ApiOkResponse({ type: PlanResponseDto })
  findOne(@Param() params: IdParamDto) {
    return this.svc.findOne(params.id);
  }

  @Put(':id')
  @Permissions('PLANS_UPDATE')
  @ApiOkResponse({ type: PlanResponseDto })
  update(@Param() params: IdParamDto, @Body() dto: UpdatePlanDto) {
    return this.svc.update(params.id, dto);
  }

  @Put(':id/approve')
  @Permissions('PLANS_APPROVE')
  @ApiOkResponse({ type: PlanResponseDto })
  approve(
    @Request() request: AuthenticatedRequest,
    @Param() params: IdParamDto,
  ) {
    return this.svc.approve(params.id, request.user.userId);
  }

  @Put(':id/reject')
  @Permissions('PLANS_APPROVE')
  @ApiOkResponse({ type: PlanResponseDto })
  reject(
    @Request() request: AuthenticatedRequest,
    @Param() params: IdParamDto,
    @Body() body: PlanDecisionDto,
  ) {
    return this.svc.reject(params.id, request.user.userId, body.rejectionNote);
  }

  @Delete(':id')
  @Permissions('PLANS_DELETE')
  @ApiOkResponse({ type: PlanResponseDto })
  remove(@Param() params: IdParamDto) {
    return this.svc.remove(params.id);
  }
}
