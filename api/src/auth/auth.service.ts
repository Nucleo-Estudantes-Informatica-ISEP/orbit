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
const REFRESH_TOKEN_TTL = '7d';

interface RefreshPayload {
  sub: string;
  email: string;
  type: 'refresh';
  roles?: string[];
  permissions?: string[];
}

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

    if (!user || user.status !== 'ACTIVE') {
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

  private signTokens(payload: {
    sub: string;
    email: string;
    roles: string[];
    permissions: string[];
  }) {
    return {
      access_token: this.jwtService.sign(
        { ...payload, type: 'access' },
        { expiresIn: ACCESS_TOKEN_TTL },
      ),
      refresh_token: this.jwtService.sign(
        { ...payload, type: 'refresh' },
        { expiresIn: REFRESH_TOKEN_TTL },
      ),
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
    const tokens = this.signTokens({
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
    try {
      const payload = this.jwtService.verify<RefreshPayload>(refreshToken);
      if (payload.type !== 'refresh') {
        throw new UnauthorizedException('Invalid refresh token type');
      }

      // Reload status, roles, and permissions on every rotation so revoked
      // access takes effect within one access-token lifetime.
      const profile = await this.buildUserPayload(payload.sub);
      return {
        user: profile,
        ...this.signTokens({
          sub: profile.id,
          email: profile.email,
          roles: profile.roles,
          permissions: profile.permissions,
        }),
      };
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
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
      throw new UnauthorizedException('Current password is incorrect');
    }

    const password = await bcrypt.hash(newPassword, 10);
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { password },
      }),
      this.prisma.passwordResetToken.updateMany({
        where: { userId, usedAt: null },
        data: { usedAt: new Date() },
      }),
    ]);

    this.mailService.sendPasswordChanged(user.email, user.name).catch(() => {});

    return { message: 'Palavra-passe alterada com sucesso.' };
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
    ]);

    return { message: 'Palavra-passe reposta com sucesso.' };
  }
}
