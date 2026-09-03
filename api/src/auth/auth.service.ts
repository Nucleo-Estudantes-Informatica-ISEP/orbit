import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma.service';
import { MailService } from '../mail/mail.service';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour
const ACCESS_TOKEN_TTL = '15m';
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private mailService: MailService,
  ) {}

  private hashToken(token: string) {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

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
      new Set(user.userRoles.flatMap(({ role }) => role.permissions ?? [])),
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
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { password, ...rest } = user;
      return rest;
    }
    return null;
  }

  private signAccessToken(payload: {
    sub: string;
    email: string;
    roles: string[];
    permissions: string[];
  }) {
    return this.jwtService.sign(
      { ...payload, token_use: 'access' },
      { expiresIn: ACCESS_TOKEN_TTL },
    );
  }

  private async createRefreshSession(
    userId: string,
    familyId = crypto.randomUUID(),
  ) {
    const refreshToken = crypto.randomBytes(48).toString('base64url');
    await this.prisma.authSession.create({
      data: {
        userId,
        familyId,
        tokenHash: this.hashToken(refreshToken),
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
      },
    });
    return refreshToken;
  }

  private async signTokens(payload: {
    sub: string;
    email: string;
    roles: string[];
    permissions: string[];
  }) {
    return {
      access_token: this.signAccessToken(payload),
      refresh_token: await this.createRefreshSession(payload.sub),
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
    const tokens = await this.signTokens({
      sub: user.id,
      email: user.email,
      roles: profile.roles,
      permissions: profile.permissions,
    });

    return {
      user: profile,
      ...tokens,
    };
  }

  async refreshToken(refreshToken: string) {
    if (typeof refreshToken !== 'string' || !refreshToken) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const now = new Date();
    const nextToken = crypto.randomBytes(48).toString('base64url');
    const rotation = await this.prisma.$transaction(async (tx) => {
      const current = await tx.authSession.findUnique({
        where: { tokenHash: this.hashToken(refreshToken) },
      });

      if (!current) return null;

      if (current.revokedAt) {
        // A rotated token was replayed. Revoke its current descendants too.
        await tx.authSession.updateMany({
          where: { familyId: current.familyId, revokedAt: null },
          data: { revokedAt: now },
        });
        return null;
      }

      if (current.expiresAt <= now) {
        await tx.authSession.update({
          where: { id: current.id },
          data: { revokedAt: now },
        });
        return null;
      }

      const consumed = await tx.authSession.updateMany({
        where: {
          id: current.id,
          revokedAt: null,
          expiresAt: { gt: now },
        },
        data: { revokedAt: now },
      });
      if (consumed.count !== 1) {
        await tx.authSession.updateMany({
          where: { familyId: current.familyId, revokedAt: null },
          data: { revokedAt: now },
        });
        return null;
      }

      await tx.authSession.create({
        data: {
          userId: current.userId,
          familyId: current.familyId,
          tokenHash: this.hashToken(nextToken),
          expiresAt: new Date(now.getTime() + REFRESH_TOKEN_TTL_MS),
        },
      });

      return {
        userId: current.userId,
        familyId: current.familyId,
        refreshToken: nextToken,
      };
    });

    if (!rotation) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    try {
      // Rebuild authorization claims so role/permission/status changes apply.
      const profile = await this.buildUserPayload(rotation.userId);
      if (profile.status !== 'ACTIVE') {
        throw new UnauthorizedException('Account is inactive');
      }

      const access_token = this.signAccessToken({
        sub: profile.id,
        email: profile.email,
        roles: profile.roles,
        permissions: profile.permissions,
      });

      return {
        user: profile,
        access_token,
        refresh_token: rotation.refreshToken,
      };
    } catch (error) {
      await this.prisma.authSession.updateMany({
        where: { familyId: rotation.familyId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      if (error instanceof UnauthorizedException) throw error;
      throw error;
    }
  }

  async logout(refreshToken: string) {
    if (typeof refreshToken === 'string' && refreshToken) {
      const session = await this.prisma.authSession.findUnique({
        where: { tokenHash: this.hashToken(refreshToken) },
        select: { familyId: true },
      });
      if (session) {
        await this.prisma.authSession.updateMany({
          where: { familyId: session.familyId, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }
    }
    return { message: 'Sessão terminada.' };
  }

  async getProfile(userId: string) {
    return this.buildUserPayload(userId);
  }

  async requestPasswordReset(email: string) {
    const genericResponse = {
      message:
        'Se existir uma conta associada a este email, será enviado um link para repor a palavra-passe.',
    };

    const user = await this.prisma.user.findUnique({ where: { email } });
    // Do not reveal whether the account exists (prevents user enumeration).
    if (!user || user.status !== 'ACTIVE') return genericResponse;

    // Invalidate any previous outstanding tokens for this user.
    await this.prisma.passwordResetToken.deleteMany({
      where: { userId: user.id, usedAt: null },
    });

    const rawToken = crypto.randomBytes(32).toString('hex');
    await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: this.hashToken(rawToken),
        expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
      },
    });

    const appUrl = (process.env.APP_URL || 'http://localhost:3090').replace(
      /\/$/,
      '',
    );
    const resetUrl = `${appUrl}/reset-password?token=${rawToken}`;
    await this.mailService.sendPasswordReset(user.email, resetUrl);

    return genericResponse;
  }

  async resetPassword(token: string, newPassword: string) {
    const record = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash: this.hashToken(token) },
    });

    if (!record || record.usedAt || record.expiresAt < new Date()) {
      throw new BadRequestException(
        'O link de reposição é inválido ou expirou.',
      );
    }

    const hashed = await bcrypt.hash(newPassword, 10);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: record.userId },
        data: { password: hashed },
      }),
      // Consume this token and clear any other outstanding ones for the user.
      this.prisma.passwordResetToken.updateMany({
        where: { userId: record.userId, usedAt: null },
        data: { usedAt: new Date() },
      }),
      this.prisma.authSession.deleteMany({
        where: { userId: record.userId },
      }),
    ]);

    return { message: 'Palavra-passe reposta com sucesso.' };
  }
}
