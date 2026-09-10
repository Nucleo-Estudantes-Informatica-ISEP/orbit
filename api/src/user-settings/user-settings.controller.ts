import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { UserSettingsService } from './user-settings.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import {
  CreateUserSettingsDto,
  UpdateUserSettingsDto,
  UserIdParamDto,
} from '../contracts/request.dto';
import { UserSettingsResponseDto } from '../contracts/response.dto';
import { ApiProtectedController } from '../contracts/openapi.decorators';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/authenticated-request';

@ApiTags('user-settings')
@ApiProtectedController()
@Controller('user-settings')
@UseGuards(JwtAuthGuard)
export class UserSettingsController {
  constructor(private svc: UserSettingsService) {}

  @Post()
  @ApiCreatedResponse({ type: UserSettingsResponseDto })
  create(
    @CurrentUser('userId') userId: string,
    @Body() body: CreateUserSettingsDto,
  ) {
    return this.svc.create({ ...body, userId });
  }

  @Get(':userId')
  @ApiOkResponse({ type: UserSettingsResponseDto })
  findOne(
    @Param() params: UserIdParamDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    this.ensureOwnOrAdmin(params.userId, user);
    return this.svc.findOne(params.userId);
  }

  @Put(':userId')
  @ApiOkResponse({ type: UserSettingsResponseDto })
  update(
    @Param() params: UserIdParamDto,
    @Body() body: UpdateUserSettingsDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    this.ensureOwnOrAdmin(params.userId, user);
    return this.svc.update(params.userId, body);
  }

  @Delete(':userId')
  @ApiOkResponse({ type: UserSettingsResponseDto })
  remove(
    @Param() params: UserIdParamDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    this.ensureOwnOrAdmin(params.userId, user);
    return this.svc.remove(params.userId);
  }

  private ensureOwnOrAdmin(targetUserId: string, user: AuthenticatedUser) {
    if (
      targetUserId !== user.userId &&
      !user.permissions?.includes('USERS_UPDATE')
    ) {
      throw new ForbiddenException('You can only access your own settings');
    }
  }
}
