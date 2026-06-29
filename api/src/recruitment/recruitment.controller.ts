import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { RecruitmentService } from './recruitment.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { Permissions } from '../auth/permissions.decorator';

@Controller('candidates')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class RecruitmentController {
  constructor(private svc: RecruitmentService) {}

  @Post()
  @Permissions('RECRUITMENT_CREATE')
  create(@Body() body: any) {
    return this.svc.create(body);
  }

  @Get()
  @Permissions('RECRUITMENT_READ')
  findAll() {
    return this.svc.findAll();
  }

  @Get(':id')
  @Permissions('RECRUITMENT_READ')
  findOne(@Param('id') id: string) {
    return this.svc.findOne(id);
  }

  @Put(':id')
  @Permissions('RECRUITMENT_UPDATE')
  update(@Param('id') id: string, @Body() body: any) {
    return this.svc.update(id, body);
  }

  @Delete(':id')
  @Permissions('RECRUITMENT_DELETE')
  remove(@Param('id') id: string) {
    return this.svc.remove(id);
  }
}
