import { randomUUID } from 'crypto';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import type { MailService } from '../src/mail/mail.service';
import { PrismaService } from '../src/prisma.service';
import { AuthService } from '../src/auth/auth.service';
import { JwtStrategy } from '../src/auth/jwt.strategy';

describe('Auth session rotation (e2e)', () => {
  const prisma = new PrismaService();
  const jwt = new JwtService({ secret: 'auth-session-e2e-secret' });
  const sendPasswordReset = jest.fn().mockResolvedValue(undefined);
  const auth = new AuthService(prisma, jwt, {
    sendPasswordReset,
  } as unknown as MailService);
  const suffix = randomUUID();
  const departmentId = randomUUID();
  const userId = randomUUID();
  const email = `auth-session-${suffix}@example.test`;

  beforeAll(async () => {
    await prisma.$connect();
    await prisma.department.create({
      data: { id: departmentId, name: `Auth session ${suffix}` },
    });
    await prisma.user.create({
      data: {
        id: userId,
        name: 'Auth Session Test',
        email,
        password: await bcrypt.hash('password', 4),
        departmentId,
      },
    });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.department.deleteMany({ where: { id: departmentId } });
    await prisma.$disconnect();
  });

  it('keeps the winning successor valid during concurrent refresh', async () => {
    const login = await auth.authenticate(email, 'password');
    const attempts = await Promise.allSettled([
      auth.refreshToken(login.refresh_token),
      auth.refreshToken(login.refresh_token),
    ]);
    const fulfilled = attempts.filter(
      (
        attempt,
      ): attempt is PromiseFulfilledResult<
        Awaited<ReturnType<AuthService['refreshToken']>>
      > => attempt.status === 'fulfilled',
    );

    expect(fulfilled).toHaveLength(1);
    await expect(
      auth.refreshToken(fulfilled[0].value.refresh_token),
    ).resolves.toHaveProperty('access_token');
  });

  it('requires a current session and uses database permissions for an issued JWT', async () => {
    const login = await auth.authenticate(email, 'password');
    const strategy = new JwtStrategy(prisma);
    const claims = jwt.verify<Parameters<JwtStrategy['validate']>[0]>(
      login.access_token,
    );
    await expect(strategy.validate(claims)).resolves.toMatchObject({
      userId,
      permissions: [],
    });
    const role = await prisma.role.create({
      data: { name: `Audit permission ${suffix}`, permissions: ['USERS_READ'] },
    });
    try {
      await prisma.userRole.create({ data: { userId, roleId: role.id } });
      await expect(strategy.validate(claims)).resolves.toMatchObject({
        permissions: ['USERS_READ'],
      });
      await auth.logout(login.refresh_token);
      await expect(strategy.validate(claims)).rejects.toThrow(
        'Session is no longer active',
      );
    } finally {
      await prisma.role.delete({ where: { id: role.id } });
    }
  });

  it('commits only one password change for a recovery token', async () => {
    await auth.requestPasswordReset(email);
    const [[, url]] = sendPasswordReset.mock.calls as [[string, string]];
    const link = new URL(url);
    expect(link.search).toBe('');
    const token = new URLSearchParams(link.hash.slice(1)).get('token');
    expect(token).toBeTruthy();
    const attempts = await Promise.allSettled([
      auth.resetPassword(token!, 'synthetic-update-one'),
      auth.resetPassword(token!, 'synthetic-update-two'),
    ]);
    expect(
      attempts.filter((attempt) => attempt.status === 'fulfilled'),
    ).toHaveLength(1);
  });
});
