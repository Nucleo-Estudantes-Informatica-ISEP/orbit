import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Req,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { UserSettingsService } from './user-settings.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthenticatedRequest } from '../auth/authenticated-request';
import type { UserSettingsInput } from './user-settings.service';

@Controller('user-settings')
@UseGuards(JwtAuthGuard)
export class UserSettingsController {
  constructor(private svc: UserSettingsService) {}

  @Post()
  create(@Body() body: UserSettingsInput) {
    return this.svc.create(body);
  }

  @Get(':userId')
  findOne(@Param('userId') userId: string, @Req() req: AuthenticatedRequest) {
    this.ensureOwnOrAdmin(userId, req.user);
    return this.svc.findOne(userId);
  }

  @Put(':userId')
  update(
    @Param('userId') userId: string,
    @Body() body: Partial<UserSettingsInput>,
    @Req() req: AuthenticatedRequest,
  ) {
    this.ensureOwnOrAdmin(userId, req.user);
    return this.svc.update(userId, body);
  }

  @Delete(':userId')
  remove(@Param('userId') userId: string, @Req() req: AuthenticatedRequest) {
    this.ensureOwnOrAdmin(userId, req.user);
    return this.svc.remove(userId);
  }

  private ensureOwnOrAdmin(
    targetUserId: string,
    user: AuthenticatedRequest['user'],
  ) {
    if (
      targetUserId !== user.userId &&
      !user.permissions?.includes('USERS_UPDATE')
    ) {
      throw new ForbiddenException('You can only access your own settings');
    }
  }
}
