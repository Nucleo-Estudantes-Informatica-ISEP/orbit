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
import { AnnouncementsService } from './announcements.service';
import { CreateAnnouncementDto } from './dto/create-announcement.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { Permissions } from '../auth/permissions.decorator';
import {
  ApiCreatedResponse,
  ApiOkResponse,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger';
import { AnnouncementQueryDto, IdParamDto } from '../contracts/request.dto';
import {
  AnnouncementResponseDto,
  CountResponseDto,
  PaginatedAnnouncementResponseDto,
} from '../contracts/response.dto';
import { ApiProtectedController } from '../contracts/openapi.decorators';
import { UpdateAnnouncementDto } from './dto/update-announcement.dto';
import { CurrentUser } from '../auth/current-user.decorator';

@ApiTags('announcements')
@ApiProtectedController()
@Controller('announcements')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AnnouncementsController {
  constructor(private readonly svc: AnnouncementsService) {}

  @Post()
  @Permissions('ANNOUNCEMENTS_CREATE')
  @ApiCreatedResponse({ type: AnnouncementResponseDto })
  create(
    @CurrentUser('userId') userId: string,
    @Body() dto: CreateAnnouncementDto,
  ) {
    return this.svc.create(dto, userId);
  }

  @Get()
  @Permissions('ANNOUNCEMENTS_READ')
  @ApiOkResponse({
    schema: {
      oneOf: [
        { $ref: getSchemaPath(PaginatedAnnouncementResponseDto) },
        {
          type: 'array',
          items: { $ref: getSchemaPath(AnnouncementResponseDto) },
        },
      ],
    },
  })
  findAll(
    @CurrentUser('userId') userId: string,
    @Query() query: AnnouncementQueryDto,
  ) {
    if (!query.page && !query.pageSize) {
      return this.svc.findAllRaw(userId, query.visibility);
    }
    return this.svc.findAll(userId, query);
  }

  @Get('me')
  @Permissions('ANNOUNCEMENTS_READ')
  @ApiOkResponse({ type: AnnouncementResponseDto, isArray: true })
  findForMe(@CurrentUser('userId') userId: string) {
    return this.svc.findAllForUser(userId);
  }

  @Put('me/read-all')
  @Permissions('ANNOUNCEMENTS_READ')
  @ApiOkResponse({ type: CountResponseDto })
  markAllRead(@CurrentUser('userId') userId: string) {
    return this.svc.markAllRead(userId);
  }

  @Get(':id')
  @Permissions('ANNOUNCEMENTS_READ')
  @ApiOkResponse({ type: AnnouncementResponseDto })
  findOne(@Param() params: IdParamDto) {
    return this.svc.findOne(params.id);
  }

  @Put(':id/read')
  @Permissions('ANNOUNCEMENTS_READ')
  @ApiOkResponse({ type: AnnouncementResponseDto })
  markRead(@Param() params: IdParamDto) {
    return this.svc.markRead(params.id);
  }

  @Put(':id')
  @Permissions('ANNOUNCEMENTS_UPDATE')
  @ApiOkResponse({ type: AnnouncementResponseDto })
  update(@Param() params: IdParamDto, @Body() body: UpdateAnnouncementDto) {
    return this.svc.update(params.id, body);
  }

  @Delete(':id')
  @Permissions('ANNOUNCEMENTS_DELETE')
  @ApiOkResponse({ type: AnnouncementResponseDto })
  remove(@Param() params: IdParamDto) {
    return this.svc.remove(params.id);
  }

  @Put(':id/pin')
  @Permissions('ANNOUNCEMENTS_UPDATE')
  @ApiOkResponse({ type: AnnouncementResponseDto })
  togglePin(@Param() params: IdParamDto) {
    return this.svc.togglePin(params.id);
  }
}
