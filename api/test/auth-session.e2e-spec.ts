import { INestApplication } from '@nestjs/common';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcryptjs';
import request from 'supertest';
import { App } from 'supertest/types';
import { AuthController } from '../src/auth/auth.controller';
import { AuthService } from '../src/auth/auth.service';
import { JwtStrategy } from '../src/auth/jwt.strategy';
import { MailService } from '../src/mail/mail.service';
import { PrismaService } from '../src/prisma.service';
import { createValidationPipe } from '../src/validation';

describe('Auth session and self-service (e2e)', () => {
  let app: INestApplication<App>;
  let jwtService: JwtService;
  const id = '1d813fc8-229d-4f66-83ad-72fd7d5b1254';
  const originalSecret = process.env.JWT_SECRET;
  const user = {
    id,
    name: 'Member',
    email: 'member@example.com',
    password: '',
    status: 'ACTIVE',
    departmentId: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    userRoles: [{ role: { name: 'Member', permissions: ['TASKS_READ'] } }],
  };

  const prisma = {
    user: {
      findUnique: jest.fn(async () => user),
      update: jest.fn(
        async ({ data }: { data: { name?: string; password?: string } }) => {
          if (data.name) user.name = data.name;
          if (data.password) user.password = data.password;
          return user;
        },
      ),
    },
    passwordResetToken: {
      updateMany: jest.fn(async () => ({ count: 0 })),
    },
    $transaction: jest.fn(async (operations: Promise<unknown>[]) =>
      Promise.all(operations),
    ),
  };

  beforeAll(async () => {
    process.env.JWT_SECRET = 'auth-e2e-secret';
    user.password = await bcrypt.hash('correct-password', 4);

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        PassportModule,
        JwtModule.register({ secret: 'auth-e2e-secret' }),
      ],
      controllers: [AuthController],
      providers: [
        AuthService,
        JwtStrategy,
        { provide: PrismaService, useValue: prisma },
        {
          provide: MailService,
          useValue: { sendPasswordChanged: jest.fn(async () => undefined) },
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(createValidationPipe());
    await app.init();
    jwtService = moduleFixture.get(JwtService);
  });

  it('issues 15-minute access and 7-day refresh tokens', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: user.email, password: 'correct-password' })
      .expect(201);

    const access = jwtService.decode<{
      exp: number;
      iat: number;
      type: string;
    }>(response.body.access_token);
    const refresh = jwtService.decode<{
      exp: number;
      iat: number;
      type: string;
    }>(response.body.refresh_token);

    expect(access.type).toBe('access');
    expect(access.exp - access.iat).toBe(15 * 60);
    expect(refresh.type).toBe('refresh');
    expect(refresh.exp - refresh.iat).toBe(7 * 24 * 60 * 60);
  });

  it('rotates both tokens and refreshes current permissions', async () => {
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: user.email, password: 'correct-password' })
      .expect(201);

    const refreshed = await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refresh_token: login.body.refresh_token })
      .expect(201);

    expect(refreshed.body.access_token).toEqual(expect.any(String));
    expect(refreshed.body.refresh_token).toEqual(expect.any(String));
    expect(refreshed.body.user.permissions).toEqual(['TASKS_READ']);
  });

  it('rejects invalid tokens and token-type confusion', async () => {
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: user.email, password: 'correct-password' })
      .expect(201);

    await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refresh_token: 'invalid' })
      .expect(401);
    await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refresh_token: login.body.access_token })
      .expect(401);
    await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${login.body.refresh_token}`)
      .expect(401);
  });

  it('allows name-only self-service and rejects privileged fields', async () => {
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: user.email, password: 'correct-password' })
      .expect(201);

    await request(app.getHttpServer())
      .put('/auth/me')
      .set('Authorization', `Bearer ${login.body.access_token}`)
      .send({ name: 'Updated Member' })
      .expect(200)
      .expect(({ body }: { body: { name: string; email: string } }) => {
        expect(body.name).toBe('Updated Member');
        expect(body.email).toBe(user.email);
      });

    await request(app.getHttpServer())
      .put('/auth/me')
      .set('Authorization', `Bearer ${login.body.access_token}`)
      .send({ name: 'Member', email: 'forged@example.com', roles: ['Admin'] })
      .expect(400);
  });

  it('requires the correct current password before changing it', async () => {
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: user.email, password: 'correct-password' })
      .expect(201);

    await request(app.getHttpServer())
      .put('/auth/change-password')
      .set('Authorization', `Bearer ${login.body.access_token}`)
      .send({
        current_password: 'wrong-password',
        new_password: 'new-password',
      })
      .expect(401);

    await request(app.getHttpServer())
      .put('/auth/change-password')
      .set('Authorization', `Bearer ${login.body.access_token}`)
      .send({
        current_password: 'correct-password',
        new_password: 'new-password',
      })
      .expect(200);

    await expect(bcrypt.compare('new-password', user.password)).resolves.toBe(
      true,
    );
  });

  afterAll(async () => {
    if (originalSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = originalSecret;
    await app.close();
  });
});
