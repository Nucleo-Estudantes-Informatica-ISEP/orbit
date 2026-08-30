import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { Permissions } from '../auth/permissions.decorator';
import { ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import {
  CreateProjectDto,
  IdParamDto,
  ProjectMemberDto,
  ProjectMemberParamDto,
  UpdateProjectDto,
} from '../contracts/request.dto';
import { ProjectResponseDto } from '../contracts/response.dto';
import { ApiProtectedController } from '../contracts/openapi.decorators';
import { CurrentUser } from '../auth/current-user.decorator';

@ApiTags('projects')
@ApiProtectedController()
@Controller('projects')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ProjectsController {
  constructor(private svc: ProjectsService) {}

  @Post()
  @Permissions('PROJECTS_CREATE')
  @ApiCreatedResponse({ type: ProjectResponseDto })
  create(
    @CurrentUser('userId') actorId: string,
    @Body() body: CreateProjectDto,
  ) {
    return this.svc.create(body, actorId);
  }

  @Get()
  @Permissions('PROJECTS_READ')
  @ApiOkResponse({ type: ProjectResponseDto, isArray: true })
  findAll() {
    return this.svc.findAll();
  }

  @Get(':id')
  @Permissions('PROJECTS_READ')
  @ApiOkResponse({ type: ProjectResponseDto })
  findOne(@Param() params: IdParamDto) {
    return this.svc.findOne(params.id);
  }

  @Put(':id')
  @Permissions('PROJECTS_UPDATE')
  @ApiOkResponse({ type: ProjectResponseDto })
  update(@Param() params: IdParamDto, @Body() body: UpdateProjectDto) {
    return this.svc.update(params.id, body);
  }

  @Delete(':id')
  @Permissions('PROJECTS_DELETE')
  @ApiOkResponse({ type: ProjectResponseDto })
  remove(@Param() params: IdParamDto) {
    return this.svc.remove(params.id);
  }

  @Post(':id/members')
  @Permissions('PROJECTS_UPDATE')
  @ApiCreatedResponse({ type: ProjectResponseDto })
  addMember(@Param() params: IdParamDto, @Body() body: ProjectMemberDto) {
    return this.svc.addMember(params.id, body.userId);
  }

  @Delete(':id/members/:userId')
  @Permissions('PROJECTS_UPDATE')
  @ApiOkResponse({ type: ProjectResponseDto })
  removeMember(@Param() params: ProjectMemberParamDto) {
    return this.svc.removeMember(params.id, params.userId);
  }
}
