import { Body, Controller, Delete, Get, Param, Post, Put, Req, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { Permissions } from '../auth/permissions.decorator';
import { ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { IdParamDto } from '../contracts/request.dto';
import { UserResponseDto, UserStatsResponseDto } from '../contracts/response.dto';
import { ApiProtectedController } from '../contracts/openapi.decorators';

@ApiTags('users')
@ApiProtectedController()
@Controller('users')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Post()
  @Permissions('USERS_CREATE')
  @ApiCreatedResponse({ type: UserResponseDto })
  create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
  }

  @Get()
  @Permissions('USERS_READ')
  @ApiOkResponse({ type: UserResponseDto, isArray: true })
  findAll() {
    return this.usersService.findAll();
  }

  @Get('stats/overview')
  @Permissions('USERS_READ')
  @ApiOkResponse({ type: UserStatsResponseDto })
  getStats() {
    return this.usersService.getStats();
  }

  @Get(':id')
  @Permissions('USERS_READ')
  @ApiOkResponse({ type: UserResponseDto })
  findOne(@Param() params: IdParamDto) {
    return this.usersService.findOne(params.id);
  }

  @Put(':id')
  @Permissions('USERS_UPDATE')
  @ApiOkResponse({ type: UserResponseDto })
  update(@Param() params: IdParamDto, @Body() dto: UpdateUserDto) {
    return this.usersService.update(params.id, dto);
  }

  @Delete(':id')
  @Permissions('USERS_DELETE')
  @ApiOkResponse({ type: UserResponseDto })
  remove(@Param() params: IdParamDto, @Req() req: any) {
    return this.usersService.remove(params.id, req.user.userId);
  }
}
