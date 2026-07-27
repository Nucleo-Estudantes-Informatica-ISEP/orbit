import { Body, Controller, Delete, Get, Param, Post, Put, Req, UseGuards, ForbiddenException } from '@nestjs/common';
import { UserSettingsService } from './user-settings.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CreateUserSettingsDto, UpdateUserSettingsDto, UserIdParamDto } from '../contracts/request.dto';
import { UserSettingsResponseDto } from '../contracts/response.dto';
import { ApiProtectedController } from '../contracts/openapi.decorators';

@ApiTags('user-settings')
@ApiProtectedController()
@Controller('user-settings')
@UseGuards(JwtAuthGuard)
export class UserSettingsController {
  constructor(private svc: UserSettingsService) {}

  @Post()
  @ApiCreatedResponse({ type: UserSettingsResponseDto })
  create(@Body() body: CreateUserSettingsDto) {
    return this.svc.create(body);
  }

  @Get(':userId')
  @ApiOkResponse({ type: UserSettingsResponseDto })
  findOne(@Param() params: UserIdParamDto, @Req() req: any) {
    this.ensureOwnOrAdmin(params.userId, req.user);
    return this.svc.findOne(params.userId);
  }

  @Put(':userId')
  @ApiOkResponse({ type: UserSettingsResponseDto })
  update(@Param() params: UserIdParamDto, @Body() body: UpdateUserSettingsDto, @Req() req: any) {
    this.ensureOwnOrAdmin(params.userId, req.user);
    return this.svc.update(params.userId, body);
  }

  @Delete(':userId')
  @ApiOkResponse({ type: UserSettingsResponseDto })
  remove(@Param() params: UserIdParamDto, @Req() req: any) {
    this.ensureOwnOrAdmin(params.userId, req.user);
    return this.svc.remove(params.userId);
  }

  private ensureOwnOrAdmin(targetUserId: string, user: any) {
    if (targetUserId !== user.userId && !user.permissions?.includes('USERS_UPDATE')) {
      throw new ForbiddenException('You can only access your own settings');
    }
  }
}
