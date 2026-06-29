import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { DepartmentsService } from './departments.service';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { Permissions } from '../auth/permissions.decorator';

@Controller('departments')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class DepartmentsController {
  constructor(private svc: DepartmentsService) {}

  @Post()
  @Permissions('DEPARTMENTS_CREATE')
  create(@Body() dto: CreateDepartmentDto) {
    return this.svc.create(dto);
  }

  @Get()
  @Permissions('DEPARTMENTS_READ')
  findAll() {
    return this.svc.findAll();
  }

  @Get(':id')
  @Permissions('DEPARTMENTS_READ')
  findOne(@Param('id') id: string) {
    return this.svc.findOne(id);
  }

  @Put(':id')
  @Permissions('DEPARTMENTS_UPDATE')
  update(@Param('id') id: string, @Body() dto: Partial<CreateDepartmentDto>) {
    return this.svc.update(id, dto);
  }

  @Delete(':id')
  @Permissions('DEPARTMENTS_DELETE')
  remove(@Param('id') id: string) {
    return this.svc.remove(id);
  }

  @Get(':id/users/count')
  @Permissions('DEPARTMENTS_READ')
  getUserCount(@Param('id') id: string) {
    return this.svc.getUserCount(id);
  }

  @Post(':id/transfer-and-delete')
  @Permissions('DEPARTMENTS_DELETE')
  transferAndDelete(@Param('id') id: string, @Body() body: { destinationDepartmentId: string }) {
    return this.svc.transferAndDelete(id, body.destinationDepartmentId);
  }
}
