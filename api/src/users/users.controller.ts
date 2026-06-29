import { Body, Controller, Delete, Get, Param, Post, Put, Req, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { Permissions } from '../auth/permissions.decorator';

@Controller('users')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Post()
  @Permissions('USERS_CREATE')
  create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
  }

  @Get()
  @Permissions('USERS_READ')
  findAll() {
    return this.usersService.findAll();
  }

  @Get('stats/overview')
  @Permissions('USERS_READ')
  getStats() {
    return this.usersService.getStats();
  }

  @Get(':id')
  @Permissions('USERS_READ')
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @Put(':id')
  @Permissions('USERS_UPDATE')
  update(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.usersService.update(id, dto);
  }

  @Delete(':id')
  @Permissions('USERS_DELETE')
  remove(@Param('id') id: string, @Req() req: any) {
    return this.usersService.remove(id, req.user.userId);
  }
}
