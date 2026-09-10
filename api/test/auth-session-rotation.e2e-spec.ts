import { randomUUID } from 'crypto';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import type { MailService } from '../src/mail/mail.service';
import { PrismaService } from '../src/prisma.service';
import { AuthService } from '../src/auth/auth.service';

describe('Auth session rotation (e2e)', () => {
  const prisma = new PrismaService();
  const auth = new AuthService(
    prisma,
    new JwtService({ secret: 'auth-session-e2e-secret' }),
    {} as MailService,
  );
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
});
