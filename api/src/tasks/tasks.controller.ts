import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { TasksService } from './tasks.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { Permissions } from '../auth/permissions.decorator';
import { ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import {
  CreateTaskDto,
  IdParamDto,
  TaskQueryDto,
  UpdateTaskDto,
} from '../contracts/request.dto';
import { TaskResponseDto } from '../contracts/response.dto';
import { ApiProtectedController } from '../contracts/openapi.decorators';
import type { AuthenticatedRequest } from '../auth/authenticated-request';

@ApiTags('tasks')
@ApiProtectedController()
@Controller('tasks')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class TasksController {
  constructor(private svc: TasksService) {}

  @Post()
  @Permissions('TASKS_CREATE')
  @ApiCreatedResponse({ type: TaskResponseDto })
  create(
    @Request() request: AuthenticatedRequest,
    @Body() body: CreateTaskDto,
  ) {
    return this.svc.create(body, request.user.userId);
  }

  @Get()
  @Permissions('TASKS_READ')
  @ApiOkResponse({ type: TaskResponseDto, isArray: true })
  findAll(@Query() query: TaskQueryDto) {
    return this.svc.findAll(query);
  }

  @Get(':id')
  @Permissions('TASKS_READ')
  @ApiOkResponse({ type: TaskResponseDto })
  findOne(@Param() params: IdParamDto) {
    return this.svc.findOne(params.id);
  }

  @Put(':id')
  @Permissions('TASKS_UPDATE')
  @ApiOkResponse({ type: TaskResponseDto })
  update(
    @Request() request: AuthenticatedRequest,
    @Param() params: IdParamDto,
    @Body() body: UpdateTaskDto,
  ) {
    return this.svc.update(params.id, body, request.user.userId);
  }

  @Delete(':id')
  @Permissions('TASKS_DELETE')
  @ApiOkResponse({ type: TaskResponseDto })
  remove(@Param() params: IdParamDto) {
    return this.svc.remove(params.id);
  }
}
