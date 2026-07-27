import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ResourcesService } from './resources.service';
import { CreateResourceDto } from './dto/create-resource.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { Permissions } from '../auth/permissions.decorator';
import { ApiCreatedResponse, ApiOkResponse, ApiTags, getSchemaPath } from '@nestjs/swagger';
import { IdParamDto, ResourceQueryDto } from '../contracts/request.dto';
import { PaginatedResourceResponseDto, ResourceResponseDto } from '../contracts/response.dto';
import { ApiProtectedController } from '../contracts/openapi.decorators';
import { UpdateResourceDto } from './dto/update-resource.dto';

@ApiTags('resources')
@ApiProtectedController()
@Controller('resources')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ResourcesController {
  constructor(private readonly svc: ResourcesService) {}

  @Post()
  @Permissions('RESOURCES_CREATE')
  @ApiCreatedResponse({ type: ResourceResponseDto })
  create(@Body() dto: CreateResourceDto) {
    return this.svc.create(dto);
  }

  @Get()
  @Permissions('RESOURCES_READ')
  @ApiOkResponse({
    schema: {
      oneOf: [
        { $ref: getSchemaPath(PaginatedResourceResponseDto) },
        { type: 'array', items: { $ref: getSchemaPath(ResourceResponseDto) } },
      ],
    },
  })
  findAll(@Query() query: ResourceQueryDto) {
    if (!query.page && !query.pageSize) {
      return this.svc.findAllRaw(query);
    }
    return this.svc.findAll(query);
  }

  @Get(':id')
  @Permissions('RESOURCES_READ')
  @ApiOkResponse({ type: ResourceResponseDto })
  findOne(@Param() params: IdParamDto) {
    return this.svc.findOne(params.id);
  }

  @Put(':id')
  @Permissions('RESOURCES_UPDATE')
  @ApiOkResponse({ type: ResourceResponseDto })
  update(@Param() params: IdParamDto, @Body() body: UpdateResourceDto) {
    return this.svc.update(params.id, body);
  }

  @Delete(':id')
  @Permissions('RESOURCES_DELETE')
  @ApiOkResponse({ type: ResourceResponseDto })
  remove(@Param() params: IdParamDto) {
    return this.svc.remove(params.id);
  }
}
