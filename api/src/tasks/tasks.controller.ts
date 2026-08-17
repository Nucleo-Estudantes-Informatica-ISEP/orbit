import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { TasksService } from './tasks.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { Permissions } from '../auth/permissions.decorator';
import type { Priority, TaskStatus } from '@prisma/client';

interface TaskInput {
  title: string;
  description?: string;
  deadline?: Date | string;
  priority?: Priority;
  status?: TaskStatus;
  boardId?: string;
  projectId?: string;
  assigneeIds?: string[];
  performedById?: string;
}

@Controller('tasks')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class TasksController {
  constructor(private svc: TasksService) {}

  @Post()
  @Permissions('TASKS_CREATE')
  create(@Body() body: TaskInput) {
    return this.svc.create(body);
  }

  @Get()
  @Permissions('TASKS_READ')
  findAll(
    @Query('boardId') boardId?: string,
    @Query('projectId') projectId?: string,
    @Query('assigneeId') assigneeId?: string,
    @Query('status') status?: string,
  ) {
    return this.svc.findAll({ boardId, projectId, assigneeId, status });
  }

  @Get(':id')
  @Permissions('TASKS_READ')
  findOne(@Param('id') id: string) {
    return this.svc.findOne(id);
  }

  @Put(':id')
  @Permissions('TASKS_UPDATE')
  update(
    @Param('id') id: string,
    @Body() body: Partial<TaskInput> & { deadline?: Date | string | null },
  ) {
    return this.svc.update(id, body);
  }

  @Delete(':id')
  @Permissions('TASKS_DELETE')
  remove(@Param('id') id: string) {
    return this.svc.remove(id);
  }
}
