import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';
import { RolesGuard } from './roles.guard';
import { MailModule } from '../mail/mail.module';
import { PrismaService } from '../prisma.service';
import { Reflector } from '@nestjs/core';
import { accessTokenOptions, authSecrets } from '../config/auth.config';
import { AuthRequestGuard } from './auth-request.guard';

@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      useFactory: () => ({
        secret: authSecrets().signing,
        signOptions: accessTokenOptions,
      }),
    }),
    MailModule,
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    PrismaService,
    RolesGuard,
    Reflector,
    AuthRequestGuard,
  ],
  exports: [AuthService],
})
export class AuthModule {}
