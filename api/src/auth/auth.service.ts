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
import type { Prisma } from '@prisma/client';
import { authSecrets } from '../config/auth.config';

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour
const ACCESS_TOKEN_TTL = '15m';
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const ROTATION_RACE_GRACE_MS = 10_000;
const dummyPasswordHash = bcrypt.hashSync(crypto.randomUUID(), 10);
export const passwordRecoveryResponse = {
  message:
    'Se existir uma conta associada a este email, será enviado um link para repor a palavra-passe.',
};

export function assertBcryptPasswordLength(password: string) {
  if (Buffer.byteLength(password, 'utf8') > 72) {
    throw new BadRequestException(
      'A palavra-passe excede o limite de 72 bytes.',
    );
  }
}

export async function lockMember(tx: Prisma.TransactionClient, userId: string) {
  await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`;
}

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private mailService: MailService,
  ) {}

  private fingerprintOpaqueToken(token: string) {
    const key = authSecrets().fingerprint;
    // Reset and refresh tokens contain 256 and 384 random bits respectively.
    // codeql[js/insufficient-password-hash]
    return crypto.createHmac('sha256', key).update(token).digest('hex');
  }

  private async buildUserPayload(
    userId: string,
    tx: Prisma.TransactionClient = this.prisma,
  ) {
    const user = await tx.user.findUnique({
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
    if (user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Account is inactive');
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
    sid: string;
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
    familyId: string,
    tx: Prisma.TransactionClient,
  ) {
    const refreshToken = crypto.randomBytes(48).toString('base64url');
    await tx.authSession.create({
      data: {
        userId,
        familyId,
        tokenHash: this.fingerprintOpaqueToken(refreshToken),
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
      },
    });
    return refreshToken;
  }

  async authenticate(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    const ok = await bcrypt.compare(
      password,
      user?.password ?? dummyPasswordHash,
    );
    if (!user || user.status !== 'ACTIVE' || !ok)
      throw new UnauthorizedException();

    return this.prisma.$transaction(async (tx) => {
      await lockMember(tx, user.id);
      const current = await tx.user.findUnique({ where: { id: user.id } });
      if (
        !current ||
        current.email !== email ||
        current.password !== user.password
      ) {
        throw new UnauthorizedException();
      }
      const profile = await this.buildUserPayload(user.id, tx);
      const familyId = crypto.randomUUID();
      await tx.auditLog.create({
        data: {
          performedById: user.id,
          action: 'LOGIN',
          entity: 'User',
          entityId: user.id,
        },
      });
      return {
        user: profile,
        access_token: this.signAccessToken({
          sub: user.id,
          sid: familyId,
          email: profile.email,
          roles: profile.roles,
          permissions: profile.permissions,
        }),
        refresh_token: await this.createRefreshSession(user.id, familyId, tx),
      };
    });
  }

  async refreshToken(refreshToken: string) {
    if (typeof refreshToken !== 'string' || !refreshToken) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const nextToken = crypto.randomBytes(48).toString('base64url');
    const tokenHash = this.fingerprintOpaqueToken(refreshToken);
    const rotation = await this.prisma.$transaction(async (tx) => {
      const session = await tx.authSession.findUnique({ where: { tokenHash } });
      if (!session) return null;
      await lockMember(tx, session.userId);

      const now = new Date();
      const current = await tx.authSession.findUnique({
        where: { tokenHash },
      });

      if (!current) return null;

      if (current.revokedAt) {
        // A near-simultaneous duplicate may have read the old browser cookie
        // before rotation completed. Reject it without invalidating the winner.
        // Replays outside this narrow race window revoke the token family.
        if (
          now.getTime() - current.revokedAt.getTime() >
          ROTATION_RACE_GRACE_MS
        ) {
          await tx.authSession.updateMany({
            where: { familyId: current.familyId, revokedAt: null },
            data: { revokedAt: now },
          });
        }
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
        // Lost a concurrent conditional consume. The winning request owns the
        // successor; do not revoke it as if this duplicate were a late replay.
        return null;
      }

      await tx.authSession.create({
        data: {
          userId: current.userId,
          familyId: current.familyId,
          tokenHash: this.fingerprintOpaqueToken(nextToken),
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
        sid: rotation.familyId,
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
      await this.prisma.$transaction(async (tx) => {
        const session = await tx.authSession.findUnique({
          where: { tokenHash: this.fingerprintOpaqueToken(refreshToken) },
        });
        if (!session) return;
        await lockMember(tx, session.userId);
        const revoked = await tx.authSession.updateMany({
          where: { familyId: session.familyId, revokedAt: null },
          data: { revokedAt: new Date() },
        });
        if (revoked.count) {
          await tx.auditLog.create({
            data: {
              performedById: session.userId,
              action: 'LOGOUT',
              entity: 'User',
              entityId: session.userId,
            },
          });
        }
      });
    }
    return { message: 'Sessão terminada.' };
  }

  async getProfile(userId: string) {
    return this.buildUserPayload(userId);
  }

  async updateOwnProfile(userId: string, name: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { name: name.trim() },
    });
    return this.buildUserPayload(userId);
  }

  async changeOwnPassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.status !== 'ACTIVE') {
      throw new UnauthorizedException('User not found');
    }

    if (!(await bcrypt.compare(currentPassword, user.password))) {
      throw new BadRequestException('Current password is incorrect');
    }

    assertBcryptPasswordLength(newPassword);
    const password = await bcrypt.hash(newPassword, 10);
    await this.prisma.$transaction(async (tx) => {
      await lockMember(tx, userId);
      const updated = await tx.user.updateMany({
        where: { id: userId, status: 'ACTIVE', password: user.password },
        data: { password },
      });
      if (!updated.count) throw new UnauthorizedException('Credential changed');
      await tx.passwordResetToken.updateMany({
        where: { userId, usedAt: null },
        data: { usedAt: new Date() },
      });
      await tx.authSession.deleteMany({ where: { userId } });
      await tx.auditLog.create({
        data: {
          performedById: userId,
          action: 'CHANGE_PASSWORD',
          entity: 'User',
          entityId: userId,
        },
      });
    });

    this.mailService.sendPasswordChanged(user.email, user.name).catch(() => {});

    return { message: 'Palavra-passe alterada com sucesso.' };
  }

  async requestPasswordReset(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || user.status !== 'ACTIVE') return;

    const origin = new URL(process.env.APP_URL || 'http://localhost:3090');
    if (process.env.NODE_ENV === 'production' && origin.protocol !== 'https:') {
      throw new Error('Password recovery requires an HTTPS APP_URL.');
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const issued = await this.prisma.$transaction(async (tx) => {
      await lockMember(tx, user.id);
      const current = await tx.user.findUnique({ where: { id: user.id } });
      if (!current || current.status !== 'ACTIVE' || current.email !== email) {
        return false;
      }
      await tx.passwordResetToken.deleteMany({
        where: { userId: user.id, usedAt: null },
      });
      await tx.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash: this.fingerprintOpaqueToken(rawToken),
          expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
        },
      });
      return true;
    });
    if (!issued) return;
    const resetUrl = new URL('/reset-password', origin);
    resetUrl.hash = new URLSearchParams({ token: rawToken }).toString();
    await this.mailService.sendPasswordReset(user.email, resetUrl.href);
  }

  async resetPassword(token: string, newPassword: string) {
    const record = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash: this.fingerprintOpaqueToken(token) },
    });

    if (!record || record.usedAt || record.expiresAt < new Date()) {
      throw new BadRequestException(
        'O link de reposição é inválido ou expirou.',
      );
    }

    assertBcryptPasswordLength(newPassword);
    const hashed = await bcrypt.hash(newPassword, 10);

    await this.prisma.$transaction(async (tx) => {
      await lockMember(tx, record.userId);
      const now = new Date();
      const active = await tx.user.findFirst({
        where: { id: record.userId, status: 'ACTIVE' },
        select: { id: true },
      });
      if (!active)
        throw new BadRequestException(
          'O link de reposição é inválido ou expirou.',
        );
      const consumed = await tx.passwordResetToken.updateMany({
        where: { id: record.id, usedAt: null, expiresAt: { gt: now } },
        data: { usedAt: now },
      });
      if (!consumed.count) {
        throw new BadRequestException(
          'O link de reposição é inválido ou expirou.',
        );
      }
      await tx.user.update({
        where: { id: record.userId, status: 'ACTIVE' },
        data: { password: hashed },
      });
      await tx.passwordResetToken.updateMany({
        where: { userId: record.userId, usedAt: null },
        data: { usedAt: now },
      });
      await tx.authSession.deleteMany({ where: { userId: record.userId } });
      await tx.auditLog.create({
        data: {
          performedById: record.userId,
          action: 'RESET_PASSWORD',
          entity: 'User',
          entityId: record.userId,
        },
      });
    });

    return { message: 'Palavra-passe reposta com sucesso.' };
  }
}
