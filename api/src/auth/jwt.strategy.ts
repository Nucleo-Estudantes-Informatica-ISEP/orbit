import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { Request } from 'express';
import type { AuthenticatedUser } from './authenticated-request';

interface JwtPayload {
  sub: string;
  email: string;
  roles?: unknown;
  permissions?: unknown;
  type?: unknown;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        (request: Request) => {
          const token = request.query.token;
          return typeof token === 'string' ? token : null;
        },
      ]),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'secret',
    });
  }

  validate(payload: JwtPayload): AuthenticatedUser {
    if (payload.type !== 'access') {
      throw new UnauthorizedException('Invalid access token type');
    }
    return {
      userId: payload.sub,
      email: payload.email,
      roles: stringArray(payload.roles),
      permissions: stringArray(payload.permissions),
    };
  }
}
