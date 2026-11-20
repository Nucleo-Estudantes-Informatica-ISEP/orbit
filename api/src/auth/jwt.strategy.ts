import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { AuthenticatedUser } from './authenticated-request';
import { PrismaService } from '../prisma.service';
import { accessTokenOptions, authSecrets } from '../config/auth.config';
import { isUUID } from 'class-validator';

interface JwtPayload {
  sub: string;
  sid?: string;
  exp?: number;
  token_use?: unknown;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: authSecrets().signing,
      algorithms: [accessTokenOptions.algorithm],
      issuer: accessTokenOptions.issuer,
      audience: accessTokenOptions.audience,
    });
  }

  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    if (
      payload.token_use !== 'access' ||
      !isUUID(payload.sub) ||
      !isUUID(payload.sid) ||
      !Number.isFinite(payload.exp)
    ) {
      throw new UnauthorizedException('Invalid access token');
    }
    const user = await this.prisma.user.findFirst({
      where: {
        id: payload.sub,
        status: 'ACTIVE',
        authSessions: {
          some: {
            familyId: payload.sid,
            revokedAt: null,
            expiresAt: { gt: new Date() },
          },
        },
      },
      select: {
        id: true,
        email: true,
        userRoles: {
          select: { role: { select: { name: true, permissions: true } } },
        },
      },
    });
    if (!user) throw new UnauthorizedException('Session is no longer active');

    return {
      userId: user.id,
      email: user.email,
      roles: user.userRoles.map(({ role }) => role.name),
      permissions: [
        ...new Set(user.userRoles.flatMap(({ role }) => role.permissions)),
      ],
    };
  }
}
