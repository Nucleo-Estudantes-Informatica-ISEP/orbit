import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { SystemPermission, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma.service';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';

interface TokenClaims {
  sub: string;
  email?: string;
  token_use: string;
  password_version?: string;
  permissions?: string[];
  iat: number;
  exp: number;
}

describe('AuthService refresh tokens', () => {
  const jwt = new JwtService({ secret: 'refresh-token-test-secret' });
  const user = {
    id: 'user-1',
    name: 'Test User',
    email: 'user@example.com',
    password: '',
    status: UserStatus.ACTIVE as UserStatus,
    userRoles: [
      {
        role: {
          name: 'Member',
          permissions: [SystemPermission.USERS_READ] as SystemPermission[],
        },
      },
    ],
  };
  let auth: AuthService;
  let users: UsersService;

  beforeEach(async () => {
    user.password = await bcrypt.hash('old-password', 10);
    user.status = UserStatus.ACTIVE;
    user.userRoles[0].role.permissions = [SystemPermission.USERS_READ];
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue(user),
        update: jest.fn(({ data }: { data: { password: string } }) =>
          Promise.resolve(Object.assign(user, data)),
        ),
      },
      passwordResetToken: {
        findUnique: jest.fn().mockResolvedValue({
          userId: user.id,
          usedAt: null,
          expiresAt: new Date(Date.now() + 60_000),
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      $transaction: (operations: Promise<unknown>[]) => Promise.all(operations),
    };
    const module = await Test.createTestingModule({
      providers: [
        AuthService,
        UsersService,
        { provide: JwtService, useValue: jwt },
        { provide: PrismaService, useValue: prisma },
        {
          provide: MailService,
          useValue: {
            sendPasswordChanged: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();
    auth = module.get(AuthService);
    users = module.get(UsersService);
  });

  it('revokes refresh tokens after resets and user password changes', async () => {
    const login = await auth.authenticate(user.email, 'old-password');
    const claims = jwt.verify<TokenClaims>(login.refresh_token);
    expect(claims.exp - claims.iat).toBe(30 * 24 * 60 * 60);
    expect(claims).not.toHaveProperty('password');
    expect(claims.password_version).not.toBe(user.password);
    expect(
      await bcrypt.compare(user.password, claims.password_version ?? ''),
    ).toBe(true);
    expect(login.user).not.toHaveProperty('password');
    await expect(
      auth.refreshToken(login.refresh_token),
    ).resolves.toHaveProperty('access_token');

    await auth.resetPassword('reset-token', 'new-password');
    await expect(auth.refreshToken(login.refresh_token)).rejects.toThrow(
      'Refresh token revoked',
    );
    await expect(auth.authenticate(user.email, 'old-password')).rejects.toThrow(
      UnauthorizedException,
    );
    const afterReset = await auth.authenticate(user.email, 'new-password');
    await expect(
      auth.refreshToken(afterReset.refresh_token),
    ).resolves.toHaveProperty('access_token');

    // Reusing the same password still changes its salted hash and revokes tokens.
    await users.update(user.id, { password: 'new-password' });
    await expect(auth.refreshToken(afterReset.refresh_token)).rejects.toThrow(
      'Refresh token revoked',
    );
    const afterChange = await auth.authenticate(user.email, 'new-password');
    await expect(
      auth.refreshToken(afterChange.refresh_token),
    ).resolves.toHaveProperty('access_token');
  });

  it('keeps short access tokens and reloads permissions and active status', async () => {
    const login = await auth.authenticate(user.email, 'old-password');
    user.userRoles[0].role.permissions = [SystemPermission.USERS_UPDATE];
    const refreshed = await auth.refreshToken(login.refresh_token);
    for (const token of [login.access_token, refreshed.access_token]) {
      const claims = jwt.verify<TokenClaims>(token);
      expect(claims.exp - claims.iat).toBe(15 * 60);
      expect(claims.token_use).toBe('access');
      expect(claims).not.toHaveProperty('password_version');
    }
    expect(jwt.verify<TokenClaims>(refreshed.access_token).permissions).toEqual(
      [SystemPermission.USERS_UPDATE],
    );
    user.status = UserStatus.INACTIVE;
    await expect(auth.refreshToken(login.refresh_token)).rejects.toThrow(
      'Account is inactive',
    );
  });

  it('rejects access, legacy, malformed, and expired refresh tokens', async () => {
    const login = await auth.authenticate(user.email, 'old-password');
    const claims = jwt.verify<TokenClaims>(login.refresh_token);
    const invalidTokens = [
      login.access_token,
      jwt.sign({ sub: user.id, token_use: 'refresh' }),
      jwt.sign({ ...claims, password_version: null }),
      jwt.sign({ ...claims, exp: 1 }),
      'not-a-jwt',
    ];
    for (const token of invalidTokens) {
      await expect(auth.refreshToken(token)).rejects.toThrow(
        UnauthorizedException,
      );
    }
    const strategy = new JwtStrategy();
    expect(() => strategy.validate(claims)).toThrow(UnauthorizedException);
    expect(
      strategy.validate(jwt.verify<TokenClaims>(login.access_token)).userId,
    ).toBe(user.id);
  });
});
