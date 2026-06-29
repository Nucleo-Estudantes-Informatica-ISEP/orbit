import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { Permissions } from '../auth/permissions.decorator';

@Controller('projects')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ProjectsController {
  constructor(private svc: ProjectsService) {}

  @Post()
  @Permissions('PROJECTS_CREATE')
  create(@Body() body: any) {
    return this.svc.create(body);
  }

  @Get()
  @Permissions('PROJECTS_READ')
  findAll() {
    return this.svc.findAll();
  }

  @Get(':id')
  @Permissions('PROJECTS_READ')
  findOne(@Param('id') id: string) {
    return this.svc.findOne(id);
  }

  @Put(':id')
  @Permissions('PROJECTS_UPDATE')
  update(@Param('id') id: string, @Body() body: any) {
    return this.svc.update(id, body);
  }

  @Delete(':id')
  @Permissions('PROJECTS_DELETE')
  remove(@Param('id') id: string) {
    return this.svc.remove(id);
  }

  @Post(':id/members')
  @Permissions('PROJECTS_UPDATE')
  addMember(@Param('id') id: string, @Body() body: { userId: string }) {
    return this.svc.addMember(id, body.userId);
  }

  @Delete(':id/members/:userId')
  @Permissions('PROJECTS_UPDATE')
  removeMember(@Param('id') id: string, @Param('userId') userId: string) {
    return this.svc.removeMember(id, userId);
  }
}
