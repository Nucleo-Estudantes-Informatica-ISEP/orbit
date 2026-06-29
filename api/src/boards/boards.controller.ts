import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { BoardsService } from './boards.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { Permissions } from '../auth/permissions.decorator';

@Controller('boards')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class BoardsController {
  constructor(private svc: BoardsService) {}

  @Post()
  @Permissions('BOARDS_CREATE')
  create(@Body() body: { name: string; description?: string; departmentIds?: string[] }) {
    return this.svc.create(body);
  }

  @Get()
  @Permissions('BOARDS_READ')
  findAll() {
    return this.svc.findAll();
  }

  @Get(':id')
  @Permissions('BOARDS_READ')
  findOne(@Param('id') id: string) {
    return this.svc.findOne(id);
  }

  @Put(':id')
  @Permissions('BOARDS_UPDATE')
  update(@Param('id') id: string, @Body() body: any) {
    return this.svc.update(id, body);
  }

  @Delete(':id')
  @Permissions('BOARDS_DELETE')
  remove(@Param('id') id: string) {
    return this.svc.remove(id);
  }
}
