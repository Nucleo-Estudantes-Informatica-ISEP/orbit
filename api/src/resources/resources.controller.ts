import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ResourcesService } from './resources.service';
import { CreateResourceDto } from './dto/create-resource.dto';
import type { UpdateResourceInput } from './resources.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { Permissions } from '../auth/permissions.decorator';

@Controller('resources')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ResourcesController {
  constructor(private readonly svc: ResourcesService) {}

  @Post()
  @Permissions('RESOURCES_CREATE')
  create(@Body() dto: CreateResourceDto) {
    return this.svc.create(dto);
  }

  @Get()
  @Permissions('RESOURCES_READ')
  findAll(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('category') category?: string,
    @Query('search') search?: string,
  ) {
    if (!page && !pageSize) {
      return this.svc.findAllRaw({ category, search });
    }
    return this.svc.findAll({ page, pageSize, category, search });
  }

  @Get(':id')
  @Permissions('RESOURCES_READ')
  findOne(@Param('id') id: string) {
    return this.svc.findOne(id);
  }

  @Put(':id')
  @Permissions('RESOURCES_UPDATE')
  update(@Param('id') id: string, @Body() body: UpdateResourceInput) {
    return this.svc.update(id, body);
  }

  @Delete(':id')
  @Permissions('RESOURCES_DELETE')
  remove(@Param('id') id: string) {
    return this.svc.remove(id);
  }
}
