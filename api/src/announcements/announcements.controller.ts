import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { AnnouncementsService } from './announcements.service';
import { CreateAnnouncementDto } from './dto/create-announcement.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { Permissions } from '../auth/permissions.decorator';

@Controller('announcements')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AnnouncementsController {
  constructor(private readonly svc: AnnouncementsService) {}

  @Post()
  @Permissions('ANNOUNCEMENTS_CREATE')
  create(@Body() dto: CreateAnnouncementDto) {
    return this.svc.create(dto);
  }

  @Get()
  @Permissions('ANNOUNCEMENTS_READ')
  findAll(@Request() req: any, @Query('page') page?: string, @Query('pageSize') pageSize?: string, @Query('visibility') visibility?: string) {
    if (!page && !pageSize) {
      return this.svc.findAllRaw(req.user.userId, visibility);
    }
    return this.svc.findAll(req.user.userId, { page, pageSize, visibility });
  }

  @Get('me')
  @Permissions('ANNOUNCEMENTS_READ')
  findForMe(@Request() req: any) {
    return this.svc.findAllForUser(req.user.userId);
  }

  @Put('me/read-all')
  @Permissions('ANNOUNCEMENTS_READ')
  markAllRead(@Request() req: any) {
    return this.svc.markAllRead(req.user.userId);
  }

  @Get(':id')
  @Permissions('ANNOUNCEMENTS_READ')
  findOne(@Param('id') id: string) {
    return this.svc.findOne(id);
  }

  @Put(':id/read')
  @Permissions('ANNOUNCEMENTS_READ')
  markRead(@Param('id') id: string) {
    return this.svc.markRead(id);
  }

  @Put(':id')
  @Permissions('ANNOUNCEMENTS_UPDATE')
  update(@Param('id') id: string, @Body() body: any) {
    return this.svc.update(id, body);
  }

  @Delete(':id')
  @Permissions('ANNOUNCEMENTS_DELETE')
  remove(@Param('id') id: string) {
    return this.svc.remove(id);
  }

  @Put(':id/pin')
  @Permissions('ANNOUNCEMENTS_UPDATE')
  togglePin(@Param('id') id: string) {
    return this.svc.togglePin(id);
  }

}
