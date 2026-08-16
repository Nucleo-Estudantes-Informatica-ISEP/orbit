import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { Permissions } from '../auth/permissions.decorator';
import { PlansService } from './plans.service';
import { CreatePlanDto } from './dto/create-plan.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';

@Controller('plans')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PlansController {
  constructor(private readonly svc: PlansService) {}

  @Post()
  @Permissions('PLANS_CREATE')
  create(@Body() dto: CreatePlanDto) {
    return this.svc.create(dto);
  }

  @Get()
  @Permissions('PLANS_READ')
  findAll(@Query('status') status?: string) {
    return this.svc.findAll(status);
  }

  @Get(':id')
  @Permissions('PLANS_READ')
  findOne(@Param('id') id: string) {
    return this.svc.findOne(id);
  }

  @Put(':id')
  @Permissions('PLANS_UPDATE')
  update(@Param('id') id: string, @Body() dto: UpdatePlanDto) {
    return this.svc.update(id, dto);
  }

  @Put(':id/approve')
  @Permissions('PLANS_APPROVE')
  approve(@Param('id') id: string, @Body() body: { approvedById: string }) {
    return this.svc.approve(id, body.approvedById);
  }

  @Put(':id/reject')
  @Permissions('PLANS_APPROVE')
  reject(
    @Param('id') id: string,
    @Body() body: { approvedById: string; rejectionNote?: string },
  ) {
    return this.svc.reject(id, body.approvedById, body.rejectionNote);
  }

  @Delete(':id')
  @Permissions('PLANS_DELETE')
  remove(@Param('id') id: string) {
    return this.svc.remove(id);
  }
}
