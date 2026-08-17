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
import { EventsService } from './events.service';
import { CreateEventDto } from './dto/create-event.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { Permissions } from '../auth/permissions.decorator';

@Controller('events')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class EventsController {
  constructor(private readonly svc: EventsService) {}

  @Post()
  @Permissions('EVENTS_CREATE')
  create(@Body() dto: CreateEventDto) {
    return this.svc.create(dto);
  }

  @Get()
  @Permissions('EVENTS_READ')
  findAll(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('filter') filter?: string,
  ) {
    if (!page && !pageSize) {
      return this.svc.findAllRaw(filter);
    }
    return this.svc.findAll({ page, pageSize, filter });
  }

  @Get(':id')
  @Permissions('EVENTS_READ')
  findOne(@Param('id') id: string) {
    return this.svc.findOne(id);
  }

  @Put(':id')
  @Permissions('EVENTS_UPDATE')
  update(@Param('id') id: string, @Body() body: Partial<CreateEventDto>) {
    return this.svc.update(id, body);
  }

  @Delete(':id')
  @Permissions('EVENTS_DELETE')
  remove(@Param('id') id: string) {
    return this.svc.remove(id);
  }
}
