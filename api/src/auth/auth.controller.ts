import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Put,
  Req,
  Res,
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
  ApiCookieAuth,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { LoginDto } from '../contracts/request.dto';
import {
  AuthTokensResponseDto,
  ErrorResponseDto,
  MessageResponseDto,
  SessionUserResponseDto,
} from '../contracts/response.dto';
import { CurrentUser } from './current-user.decorator';
import type { Request, Response } from 'express';

const REFRESH_COOKIE = 'orbit_refresh';
const REFRESH_COOKIE_PATH = '/auth';
const REFRESH_COOKIE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const REFRESH_COOKIE_RESPONSE_HEADERS = {
  'Set-Cookie': {
    description:
      'Rotated 30-day orbit_refresh cookie; HttpOnly; SameSite=Strict; Path=/auth; Secure in production.',
    schema: { type: 'string' },
  },
};

function readRefreshCookie(request: Request): string {
  const cookies = request.headers.cookie?.split(';') ?? [];
  for (const cookie of cookies) {
    const [name, ...value] = cookie.trim().split('=');
    if (name === REFRESH_COOKIE) {
      try {
        return decodeURIComponent(value.join('='));
      } catch {
        return '';
      }
    }
  }
  return '';
}

function setRefreshCookie(response: Response, token: string) {
  response.cookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: REFRESH_COOKIE_PATH,
    maxAge: REFRESH_COOKIE_MAX_AGE_MS,
  });
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  @ApiCreatedResponse({
    type: AuthTokensResponseDto,
    headers: REFRESH_COOKIE_RESPONSE_HEADERS,
  })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  async login(
    @Body() body: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const { refresh_token, ...session } = await this.authService.authenticate(
      body.email,
      body.password,
    );
    setRefreshCookie(response, refresh_token);
    return session;
  }

  @Post('refresh')
  @ApiCookieAuth(REFRESH_COOKIE)
  @ApiCreatedResponse({
    type: AuthTokensResponseDto,
    headers: REFRESH_COOKIE_RESPONSE_HEADERS,
  })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const { refresh_token, ...session } = await this.authService.refreshToken(
      readRefreshCookie(request),
    );
    setRefreshCookie(response, refresh_token);
    return session;
  }

  @Post('logout')
  @HttpCode(200)
  @ApiCookieAuth(REFRESH_COOKIE)
  @ApiOkResponse({
    type: MessageResponseDto,
    headers: REFRESH_COOKIE_RESPONSE_HEADERS,
  })
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.logout(readRefreshCookie(request));
    response.clearCookie(REFRESH_COOKIE, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: REFRESH_COOKIE_PATH,
    });
    return result;
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
  async me(@CurrentUser('userId') userId: string) {
    return this.authService.getProfile(userId);
  }

  @Put('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOkResponse({ type: SessionUserResponseDto })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  async updateMe(
    @CurrentUser('userId') userId: string,
    @Body() dto: UpdateOwnProfileDto,
  ) {
    return this.authService.updateOwnProfile(userId, dto.name);
  }

  @Put('change-password')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOkResponse({ type: MessageResponseDto })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  async changePassword(
    @CurrentUser('userId') userId: string,
    @Body() dto: ChangeOwnPasswordDto,
  ) {
    return this.authService.changeOwnPassword(
      userId,
      dto.current_password,
      dto.new_password,
    );
  }
}
