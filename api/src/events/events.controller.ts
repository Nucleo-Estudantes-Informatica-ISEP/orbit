import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { EventsService } from './events.service';
import { CreateEventDto } from './dto/create-event.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { Permissions } from '../auth/permissions.decorator';
import { ApiCreatedResponse, ApiOkResponse, ApiTags, getSchemaPath } from '@nestjs/swagger';
import { EventQueryDto, IdParamDto } from '../contracts/request.dto';
import { EventResponseDto, PaginatedEventResponseDto } from '../contracts/response.dto';
import { ApiProtectedController } from '../contracts/openapi.decorators';
import { UpdateEventDto } from './dto/update-event.dto';

@ApiTags('events')
@ApiProtectedController()
@Controller('events')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class EventsController {
  constructor(private readonly svc: EventsService) {}

  @Post()
  @Permissions('EVENTS_CREATE')
  @ApiCreatedResponse({ type: EventResponseDto })
  create(@Body() dto: CreateEventDto) {
    return this.svc.create(dto);
  }

  @Get()
  @Permissions('EVENTS_READ')
  @ApiOkResponse({
    schema: {
      oneOf: [
        { $ref: getSchemaPath(PaginatedEventResponseDto) },
        { type: 'array', items: { $ref: getSchemaPath(EventResponseDto) } },
      ],
    },
  })
  findAll(@Query() query: EventQueryDto) {
    if (!query.page && !query.pageSize) {
      return this.svc.findAllRaw(query.filter);
    }
    return this.svc.findAll(query);
  }

  @Get(':id')
  @Permissions('EVENTS_READ')
  @ApiOkResponse({ type: EventResponseDto })
  findOne(@Param() params: IdParamDto) {
    return this.svc.findOne(params.id);
  }

  @Put(':id')
  @Permissions('EVENTS_UPDATE')
  @ApiOkResponse({ type: EventResponseDto })
  update(@Param() params: IdParamDto, @Body() body: UpdateEventDto) {
    return this.svc.update(params.id, body);
  }

  @Delete(':id')
  @Permissions('EVENTS_DELETE')
  @ApiOkResponse({ type: EventResponseDto })
  remove(@Param() params: IdParamDto) {
    return this.svc.remove(params.id);
  }
}
