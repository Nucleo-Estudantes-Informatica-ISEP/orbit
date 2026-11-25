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
import { ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { IdParamDto, TransferRoleDto } from '../contracts/request.dto';
import { CountResponseDto, RoleResponseDto } from '../contracts/response.dto';
import { ApiProtectedController } from '../contracts/openapi.decorators';
import { UpdateRoleDto } from './update-role.dto';
import { CurrentUser } from '../auth/current-user.decorator';

@ApiTags('roles')
@ApiProtectedController()
@Controller('roles')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class RolesController {
  constructor(private svc: RolesService) {}

  @Post()
  @Permissions('ROLES_CREATE')
  @ApiCreatedResponse({ type: RoleResponseDto })
  create(@Body() dto: CreateRoleDto, @CurrentUser('userId') actorId: string) {
    return this.svc.create(dto, actorId);
  }

  @Get()
  @Permissions('ROLES_READ')
  @ApiOkResponse({ type: RoleResponseDto, isArray: true })
  findAll() {
    return this.svc.findAll();
  }

  @Get(':id')
  @Permissions('ROLES_READ')
  @ApiOkResponse({ type: RoleResponseDto })
  findOne(@Param() params: IdParamDto) {
    return this.svc.findOne(params.id);
  }

  @Put(':id')
  @Permissions('ROLES_UPDATE')
  @ApiOkResponse({ type: RoleResponseDto })
  update(
    @Param() params: IdParamDto,
    @Body() dto: UpdateRoleDto,
    @CurrentUser('userId') actorId: string,
  ) {
    return this.svc.update(params.id, dto, actorId);
  }

  @Delete(':id')
  @Permissions('ROLES_DELETE')
  @ApiOkResponse({ type: RoleResponseDto })
  remove(@Param() params: IdParamDto, @CurrentUser('userId') actorId: string) {
    return this.svc.remove(params.id, actorId);
  }

  @Get(':id/users/count')
  @Permissions('ROLES_READ')
  @ApiOkResponse({ type: CountResponseDto })
  getUserCount(@Param() params: IdParamDto) {
    return this.svc.getUserCount(params.id);
  }

  @Post(':id/transfer-and-delete')
  @Permissions('ROLES_DELETE')
  @ApiCreatedResponse({ type: RoleResponseDto })
  transferAndDelete(
    @Param() params: IdParamDto,
    @Body() body: TransferRoleDto,
    @CurrentUser('userId') actorId: string,
  ) {
    return this.svc.transferAndDelete(
      params.id,
      body.destinationRoleId,
      actorId,
    );
  }
}
