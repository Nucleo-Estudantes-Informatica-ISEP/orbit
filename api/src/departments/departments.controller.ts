import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { DepartmentsService } from './departments.service';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { Permissions } from '../auth/permissions.decorator';
import { ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { IdParamDto, TransferDepartmentDto } from '../contracts/request.dto';
import { CountResponseDto, DepartmentResponseDto } from '../contracts/response.dto';
import { ApiProtectedController } from '../contracts/openapi.decorators';
import { UpdateDepartmentDto } from './dto/update-department.dto';

@ApiTags('departments')
@ApiProtectedController()
@Controller('departments')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class DepartmentsController {
  constructor(private svc: DepartmentsService) {}

  @Post()
  @Permissions('DEPARTMENTS_CREATE')
  @ApiCreatedResponse({ type: DepartmentResponseDto })
  create(@Body() dto: CreateDepartmentDto) {
    return this.svc.create(dto);
  }

  @Get()
  @Permissions('DEPARTMENTS_READ')
  @ApiOkResponse({ type: DepartmentResponseDto, isArray: true })
  findAll() {
    return this.svc.findAll();
  }

  @Get(':id')
  @Permissions('DEPARTMENTS_READ')
  @ApiOkResponse({ type: DepartmentResponseDto })
  findOne(@Param() params: IdParamDto) {
    return this.svc.findOne(params.id);
  }

  @Put(':id')
  @Permissions('DEPARTMENTS_UPDATE')
  @ApiOkResponse({ type: DepartmentResponseDto })
  update(@Param() params: IdParamDto, @Body() dto: UpdateDepartmentDto) {
    return this.svc.update(params.id, dto);
  }

  @Delete(':id')
  @Permissions('DEPARTMENTS_DELETE')
  @ApiOkResponse({ type: DepartmentResponseDto })
  remove(@Param() params: IdParamDto) {
    return this.svc.remove(params.id);
  }

  @Get(':id/users/count')
  @Permissions('DEPARTMENTS_READ')
  @ApiOkResponse({ type: CountResponseDto })
  getUserCount(@Param() params: IdParamDto) {
    return this.svc.getUserCount(params.id);
  }

  @Post(':id/transfer-and-delete')
  @Permissions('DEPARTMENTS_DELETE')
  @ApiCreatedResponse({ type: DepartmentResponseDto })
  transferAndDelete(@Param() params: IdParamDto, @Body() body: TransferDepartmentDto) {
    return this.svc.transferAndDelete(params.id, body.destinationDepartmentId);
  }
}
