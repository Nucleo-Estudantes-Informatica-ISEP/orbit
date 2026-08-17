import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { RolesService } from './roles.service';
import { CreateRoleDto } from './create-role.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { Permissions } from '../auth/permissions.decorator';

@Controller('roles')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class RolesController {
  constructor(private svc: RolesService) {}

  @Post()
  @Permissions('ROLES_CREATE')
  create(@Body() dto: CreateRoleDto) {
    return this.svc.create(dto);
  }

  @Get()
  @Permissions('ROLES_READ')
  findAll() {
    return this.svc.findAll();
  }

  @Get(':id')
  @Permissions('ROLES_READ')
  findOne(@Param('id') id: string) {
    return this.svc.findOne(id);
  }

  @Put(':id')
  @Permissions('ROLES_UPDATE')
  update(@Param('id') id: string, @Body() dto: Partial<CreateRoleDto>) {
    return this.svc.update(id, dto);
  }

  @Delete(':id')
  @Permissions('ROLES_DELETE')
  remove(@Param('id') id: string) {
    return this.svc.remove(id);
  }

  @Get(':id/users/count')
  @Permissions('ROLES_READ')
  getUserCount(@Param('id') id: string) {
    return this.svc.getUserCount(id);
  }

  @Post(':id/transfer-and-delete')
  @Permissions('ROLES_DELETE')
  transferAndDelete(
    @Param('id') id: string,
    @Body() body: { destinationRoleId: string },
  ) {
    return this.svc.transferAndDelete(id, body.destinationRoleId);
  }
}
