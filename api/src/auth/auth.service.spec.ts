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

interface AccessClaims {
  sub: string;
  email: string;
  token_use: string;
  permissions: string[];
  iat: number;
  exp: number;
}

interface StoredSession {
  id: string;
  userId: string;
  tokenHash: string;
  familyId: string;
  expiresAt: Date;
  revokedAt: Date | null;
  createdAt: Date;
}

describe('AuthService sessions', () => {
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
  let sessions: StoredSession[];
  let auth: AuthService;
  let users: UsersService;

  beforeEach(async () => {
    sessions = [];
    user.password = await bcrypt.hash('old-password', 10);
    user.status = UserStatus.ACTIVE;
    user.userRoles[0].role.permissions = [SystemPermission.USERS_READ];
    let sessionSequence = 0;

    const matches = (
      session: StoredSession,
      where: Record<string, unknown>,
    ) => {
      if (where.id !== undefined && session.id !== where.id) return false;
      if (where.userId !== undefined && session.userId !== where.userId)
        return false;
      if (where.familyId !== undefined && session.familyId !== where.familyId)
        return false;
      if (where.revokedAt === null && session.revokedAt !== null) return false;
      const expiry = where.expiresAt as { gt?: Date } | undefined;
      if (expiry?.gt && session.expiresAt <= expiry.gt) return false;
      return true;
    };

    const prisma: Record<string, unknown> = {
      user: {
        findUnique: jest.fn().mockResolvedValue(user),
        update: jest.fn(({ data }: { data: { password: string } }) =>
          Promise.resolve(Object.assign(user, data)),
        ),
      },
      authSession: {
        create: jest.fn(
          ({
            data,
          }: {
            data: Omit<StoredSession, 'id' | 'revokedAt' | 'createdAt'>;
          }) => {
            const session: StoredSession = {
              ...data,
              id: `session-${++sessionSequence}`,
              revokedAt: null,
              createdAt: new Date(),
            };
            sessions.push(session);
            return Promise.resolve(session);
          },
        ),
        findUnique: jest.fn(
          ({
            where,
            select,
          }: {
            where: { tokenHash: string };
            select?: { familyId: boolean };
          }) => {
            const session =
              sessions.find((item) => item.tokenHash === where.tokenHash) ??
              null;
            return Promise.resolve(
              session && select ? { familyId: session.familyId } : session,
            );
          },
        ),
        update: jest.fn(
          ({
            where,
            data,
          }: {
            where: { id: string };
            data: Partial<StoredSession>;
          }) => {
            const session = sessions.find((item) => item.id === where.id);
            if (!session) throw new Error('Session not found');
            Object.assign(session, data);
            return Promise.resolve(session);
          },
        ),
        updateMany: jest.fn(
          ({
            where,
            data,
          }: {
            where: Record<string, unknown>;
            data: Partial<StoredSession>;
          }) => {
            const selected = sessions.filter((session) =>
              matches(session, where),
            );
            selected.forEach((session) => Object.assign(session, data));
            return Promise.resolve({ count: selected.length });
          },
        ),
        deleteMany: jest.fn(({ where }: { where: Record<string, unknown> }) => {
          const before = sessions.length;
          sessions = sessions.filter((session) => !matches(session, where));
          return Promise.resolve({ count: before - sessions.length });
        }),
      },
      passwordResetToken: {
        findUnique: jest.fn().mockResolvedValue({
          userId: user.id,
          usedAt: null,
          expiresAt: new Date(Date.now() + 60_000),
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      $transaction: jest.fn((operation: unknown) =>
        typeof operation === 'function'
          ? (operation as (client: unknown) => Promise<unknown>)(prisma)
          : Promise.all(operation as Promise<unknown>[]),
      ),
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

  it('issues 15-minute access and 30-day opaque refresh tokens', async () => {
    const login = await auth.authenticate(user.email, 'old-password');
    const claims = jwt.verify<AccessClaims>(login.access_token);

    expect(claims.exp - claims.iat).toBe(15 * 60);
    expect(claims.token_use).toBe('access');
    expect(login.refresh_token).not.toContain('.');
    expect(sessions).toHaveLength(1);
    expect(
      sessions[0].expiresAt.getTime() - sessions[0].createdAt.getTime(),
    ).toBeCloseTo(30 * 24 * 60 * 60 * 1000, -3);
  });

  it('rotates refresh tokens, tolerates request races, and revokes late replays', async () => {
    const login = await auth.authenticate(user.email, 'old-password');
    user.userRoles[0].role.permissions = [SystemPermission.USERS_UPDATE];

    const refreshed = await auth.refreshToken(login.refresh_token);
    expect(refreshed.refresh_token).not.toBe(login.refresh_token);
    expect(refreshed.user.permissions).toEqual([SystemPermission.USERS_UPDATE]);
    expect(
      jwt.verify<AccessClaims>(refreshed.access_token).permissions,
    ).toEqual([SystemPermission.USERS_UPDATE]);
    expect(sessions.filter((session) => !session.revokedAt)).toHaveLength(1);

    await expect(auth.refreshToken(login.refresh_token)).rejects.toThrow(
      'Invalid or expired refresh token',
    );
    await expect(
      auth.refreshToken(refreshed.refresh_token),
    ).resolves.toHaveProperty('refresh_token');

    sessions[0].revokedAt = new Date(Date.now() - 11_000);
    await expect(auth.refreshToken(login.refresh_token)).rejects.toThrow(
      'Invalid or expired refresh token',
    );
    expect(sessions.every((session) => session.revokedAt)).toBe(true);
  });

  it('revokes refresh sessions after resets and user password changes', async () => {
    const login = await auth.authenticate(user.email, 'old-password');
    await auth.resetPassword('reset-token', 'new-password');
    expect(sessions).toHaveLength(0);
    await expect(auth.refreshToken(login.refresh_token)).rejects.toThrow(
      UnauthorizedException,
    );

    const afterReset = await auth.authenticate(user.email, 'new-password');
    await users.update(user.id, { password: 'new-password' });
    expect(sessions).toHaveLength(0);
    await expect(auth.refreshToken(afterReset.refresh_token)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rejects inactive users, malformed refresh values, and refresh tokens on protected routes', async () => {
    const login = await auth.authenticate(user.email, 'old-password');
    user.status = UserStatus.INACTIVE;
    await expect(auth.refreshToken(login.refresh_token)).rejects.toThrow(
      'Account is inactive',
    );
    expect(sessions.every((session) => session.revokedAt)).toBe(true);

    await expect(auth.refreshToken(login.access_token)).rejects.toThrow(
      UnauthorizedException,
    );
    await expect(auth.refreshToken('')).rejects.toThrow(UnauthorizedException);

    const strategy = new JwtStrategy();
    expect(() =>
      strategy.validate({ sub: user.id, email: user.email }),
    ).toThrow('Invalid access token');
    expect(() =>
      strategy.validate({
        sub: '',
        email: user.email,
        token_use: 'access',
      }),
    ).toThrow('Invalid access token');
    expect(
      strategy.validate(jwt.verify<AccessClaims>(login.access_token)).userId,
    ).toBe(user.id);
  });

  it('revokes a session family on logout', async () => {
    const login = await auth.authenticate(user.email, 'old-password');
    await expect(auth.logout(login.refresh_token)).resolves.toEqual({
      message: 'Sessão terminada.',
    });
    expect(sessions.every((session) => session.revokedAt)).toBe(true);
    await expect(auth.refreshToken(login.refresh_token)).rejects.toThrow(
      UnauthorizedException,
    );
  });
});
