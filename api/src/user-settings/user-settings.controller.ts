import { Body, Controller, Delete, Get, Param, Post, Put, Req, UseGuards, ForbiddenException } from '@nestjs/common';
import { UserSettingsService } from './user-settings.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('user-settings')
@UseGuards(JwtAuthGuard)
export class UserSettingsController {
  constructor(private svc: UserSettingsService) {}

  @Post()
  create(@Body() body: any) {
    return this.svc.create(body);
  }

  @Get(':userId')
  findOne(@Param('userId') userId: string, @Req() req: any) {
    this.ensureOwnOrAdmin(userId, req.user);
    return this.svc.findOne(userId);
  }

  @Put(':userId')
  update(@Param('userId') userId: string, @Body() body: any, @Req() req: any) {
    this.ensureOwnOrAdmin(userId, req.user);
    return this.svc.update(userId, body);
  }

  @Delete(':userId')
  remove(@Param('userId') userId: string, @Req() req: any) {
    this.ensureOwnOrAdmin(userId, req.user);
    return this.svc.remove(userId);
  }

  private ensureOwnOrAdmin(targetUserId: string, user: any) {
    if (targetUserId !== user.userId && !user.permissions?.includes('USERS_UPDATE')) {
      throw new ForbiddenException('You can only access your own settings');
    }
  }
}
