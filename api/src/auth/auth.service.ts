import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma.service';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class AuthService {
  constructor(private prisma: PrismaService, private jwtService: JwtService) {}

  private async buildUserPayload(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        userRoles: {
          include: {
            role: true,
          },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const permissions = Array.from(
      new Set(
        user.userRoles.flatMap(({ role }) => role.permissions ?? []),
      ),
    );

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, userRoles, ...rest } = user;
    const roles = userRoles.map(({ role }) => role.name);

    return { ...rest, roles, permissions };
  }

  async validateUser(email: string, pass: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) return null;
    if (user.status !== 'ACTIVE') return null;
    const match = await bcrypt.compare(pass, user.password);
    if (match) {
      // exclude password
      // @ts-ignore
      const { password, ...rest } = user;
      return rest;
    }
    return null;
  }

  async login(user: any) {
    const payload = { sub: user.id, email: user.email };
    return { access_token: this.jwtService.sign(payload) };
  }

  private signTokens(payload: { sub: string; email: string; roles: string[]; permissions: string[] }) {
    return {
      access_token: this.jwtService.sign(payload, { expiresIn: '15m' }),
      refresh_token: this.jwtService.sign(payload, { expiresIn: '15m' }),
    };
  }

  async authenticate(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) throw new UnauthorizedException();
    if (user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Account is inactive');
    }
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) throw new UnauthorizedException();

    const profile = await this.buildUserPayload(user.id);
    const tokens = this.signTokens({ sub: user.id, email: user.email, roles: profile.roles, permissions: profile.permissions });

    return {
      user: profile,
      ...tokens,
    };
  }

  async refreshToken(refreshToken: string) {
    try {
      const payload = this.jwtService.verify(refreshToken);
      const access_token = this.jwtService.sign({
        sub: payload.sub,
        email: payload.email,
        roles: payload.roles ?? [],
        permissions: payload.permissions ?? [],
      }, { expiresIn: '8h' });
      return { access_token };
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  async getProfile(userId: string) {
    return this.buildUserPayload(userId);
  }
}
