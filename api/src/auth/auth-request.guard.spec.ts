import {
  Controller,
  Post,
  UseGuards,
  type ExecutionContext,
  ForbiddenException,
  HttpException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { AuthRequestGuard } from './auth-request.guard';

function context(
  origin?: string,
  ip = '127.0.0.1',
  email = 'Synthetic@Example.test',
): ExecutionContext {
  function login() {}
  return {
    getHandler: () => login,
    switchToHttp: () => ({
      getRequest: () => ({
        ip,
        body: { email },
        get: (header: string) => (header === 'origin' ? origin : undefined),
      }),
    }),
  } as unknown as ExecutionContext;
}

describe('authentication request guard', () => {
  it('rejects an untrusted browser origin', () => {
    const guard = new AuthRequestGuard();
    expect(() =>
      guard.canActivate(context('https://untrusted.invalid')),
    ).toThrow(ForbiddenException);
  });

  it('limits repeated requests for the same IP and account', () => {
    const guard = new AuthRequestGuard();
    for (let i = 0; i < 12; i++)
      expect(guard.canActivate(context())).toBe(true);
    expect(() => guard.canActivate(context())).toThrow(HttpException);
    expect(guard.canActivate(context(undefined, '127.0.0.2'))).toBe(true);
  });
  it('keeps accepting new identities when the secondary buckets fill', () => {
    const guard = new AuthRequestGuard();
    for (let i = 0; i < 10_001; i++) {
      guard.canActivate(
        context(
          undefined,
          String(Math.floor(i / 100)),
          `user${i}@example.test`,
        ),
      );
    }
    expect(guard.canActivate(context(undefined, 'another-client'))).toBe(true);
    for (let i = 0; i < 20; i++) {
      guard.canActivate(context(undefined, '0', `extra${i}@example.test`));
    }
    expect(() => guard.canActivate(context(undefined, '0'))).toThrow(
      HttpException,
    );
  });
});

@Controller('auth')
@UseGuards(AuthRequestGuard)
class AuthFixture {
  @Post('login')
  login() {
    return true;
  }
}

it('uses the trusted forwarded IP and normalizes the configured browser origin', async () => {
  const previousOrigin = process.env.CORS_ORIGIN;
  process.env.CORS_ORIGIN = ' https://orbit.example.test/ ';
  const fixture = await Test.createTestingModule({
    controllers: [AuthFixture],
  }).compile();
  const app = fixture.createNestApplication<NestExpressApplication>();
  try {
    app.set('trust proxy', 1);
    await app.init();
    const login = (ip: string) =>
      request(app.getHttpServer() as Parameters<typeof request>[0])
        .post('/auth/login')
        .set('Origin', 'https://orbit.example.test')
        .set('X-Forwarded-For', ip)
        .send({ email: 'fixture@example.test' });
    for (let i = 0; i < 12; i++) await login('192.0.2.1').expect(201);
    await login('192.0.2.1').expect(429);
    await login('192.0.2.2').expect(201);
  } finally {
    if (previousOrigin === undefined) delete process.env.CORS_ORIGIN;
    else process.env.CORS_ORIGIN = previousOrigin;
    await app.close();
  }
});
