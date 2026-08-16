import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ChangeOwnPasswordDto } from './dto/change-own-password.dto';
import { UpdateOwnProfileDto } from './dto/update-own-profile.dto';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { LoginDto, RefreshTokenDto } from '../contracts/request.dto';
import {
  AuthTokensResponseDto,
  ErrorResponseDto,
  MessageResponseDto,
  SessionUserResponseDto,
} from '../contracts/response.dto';
import type { AuthenticatedRequest } from './authenticated-request';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  @ApiCreatedResponse({ type: AuthTokensResponseDto })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  async login(@Body() body: LoginDto) {
    return this.authService.authenticate(body.email, body.password);
  }

  @Post('refresh')
  @ApiCreatedResponse({ type: AuthTokensResponseDto })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  async refresh(@Body() body: RefreshTokenDto) {
    return this.authService.refreshToken(body.refresh_token);
  }

  @Post('forgot-password')
  @HttpCode(200)
  @ApiOkResponse({ type: MessageResponseDto })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.requestPasswordReset(dto.email);
  }

  @Post('reset-password')
  @HttpCode(200)
  @ApiOkResponse({ type: MessageResponseDto })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto.token, dto.password);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOkResponse({ type: SessionUserResponseDto })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  async me(@Req() req: AuthenticatedRequest) {
    return this.authService.getProfile(req.user.userId);
  }

  @Put('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOkResponse({ type: SessionUserResponseDto })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  async updateMe(
    @Req() req: AuthenticatedRequest,
    @Body() dto: UpdateOwnProfileDto,
  ) {
    return this.authService.updateOwnProfile(req.user.userId, dto.name);
  }

  @Put('change-password')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOkResponse({ type: MessageResponseDto })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  async changePassword(
    @Req() req: AuthenticatedRequest,
    @Body() dto: ChangeOwnPasswordDto,
  ) {
    return this.authService.changeOwnPassword(
      req.user.userId,
      dto.current_password,
      dto.new_password,
    );
  }
}
