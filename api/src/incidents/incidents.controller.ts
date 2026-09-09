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
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { Permissions } from '../auth/permissions.decorator';
import { IncidentsService } from './incidents.service';
import { ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import {
  CommentIdParamDto,
  CreateIncidentCommentDto,
  CreateIncidentDto,
  IdParamDto,
  IncidentQueryDto,
  UpdateIncidentDto,
} from '../contracts/request.dto';
import {
  IncidentCommentResponseDto,
  IncidentResponseDto,
} from '../contracts/response.dto';
import { ApiProtectedController } from '../contracts/openapi.decorators';
import { CurrentUser } from '../auth/current-user.decorator';

@ApiTags('incidents')
@ApiProtectedController()
@Controller('incidents')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class IncidentsController {
  constructor(private readonly svc: IncidentsService) {}

  @Post()
  @Permissions('INCIDENTS_CREATE')
  @ApiCreatedResponse({ type: IncidentResponseDto })
  create(
    @CurrentUser('userId') actorId: string,
    @Body() body: CreateIncidentDto,
  ) {
    return this.svc.create(body, actorId);
  }

  @Get()
  @Permissions('INCIDENTS_READ')
  @ApiOkResponse({ type: IncidentResponseDto, isArray: true })
  findAll(@Query() query: IncidentQueryDto) {
    return this.svc.findAll(query.departmentId);
  }

  @Get(':id')
  @Permissions('INCIDENTS_READ')
  @ApiOkResponse({ type: IncidentResponseDto })
  findOne(@Param() params: IdParamDto) {
    return this.svc.findOne(params.id);
  }

  @Put(':id')
  @Permissions('INCIDENTS_UPDATE')
  @ApiOkResponse({ type: IncidentResponseDto })
  update(@Param() params: IdParamDto, @Body() body: UpdateIncidentDto) {
    return this.svc.update(params.id, body);
  }

  @Post(':id/comments')
  @Permissions('INCIDENTS_UPDATE')
  @ApiCreatedResponse({ type: IncidentResponseDto })
  addComment(
    @CurrentUser('userId') actorId: string,
    @Param() params: IdParamDto,
    @Body() body: CreateIncidentCommentDto,
  ) {
    return this.svc.addComment(params.id, body, actorId);
  }

  @Delete('comments/:commentId')
  @Permissions('INCIDENTS_DELETE')
  @ApiOkResponse({ type: IncidentCommentResponseDto })
  removeComment(@Param() params: CommentIdParamDto) {
    return this.svc.removeComment(params.commentId);
  }

  @Delete(':id')
  @Permissions('INCIDENTS_DELETE')
  @ApiOkResponse({ type: IncidentResponseDto })
  remove(@Param() params: IdParamDto) {
    return this.svc.remove(params.id);
  }
}
