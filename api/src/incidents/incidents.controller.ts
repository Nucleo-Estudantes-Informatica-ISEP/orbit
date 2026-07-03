import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { Permissions } from '../auth/permissions.decorator';
import { IncidentsService } from './incidents.service';

@Controller('incidents')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class IncidentsController {
  constructor(private readonly svc: IncidentsService) {}

  @Post()
  @Permissions('INCIDENTS_CREATE')
  create(@Body() body: any) {
    return this.svc.create(body);
  }

  @Get()
  @Permissions('INCIDENTS_READ')
  findAll(@Query('departmentId') departmentId?: string) {
    return this.svc.findAll(departmentId);
  }

  @Get(':id')
  @Permissions('INCIDENTS_READ')
  findOne(@Param('id') id: string) {
    return this.svc.findOne(id);
  }

  @Put(':id')
  @Permissions('INCIDENTS_UPDATE')
  update(@Param('id') id: string, @Body() body: any) {
    return this.svc.update(id, body);
  }

  @Post(':id/comments')
  @Permissions('INCIDENTS_UPDATE')
  addComment(@Param('id') id: string, @Body() body: any) {
    return this.svc.addComment(id, body);
  }

  @Delete('comments/:commentId')
  @Permissions('INCIDENTS_DELETE')
  removeComment(@Param('commentId') commentId: string) {
    return this.svc.removeComment(commentId);
  }

  @Delete(':id')
  @Permissions('INCIDENTS_DELETE')
  remove(@Param('id') id: string) {
    return this.svc.remove(id);
  }
}
