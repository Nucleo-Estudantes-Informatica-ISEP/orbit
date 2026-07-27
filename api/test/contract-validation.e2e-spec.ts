import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { JwtAuthGuard } from '../src/auth/jwt-auth.guard';
import { PermissionsGuard } from '../src/auth/permissions.guard';
import { TasksController } from '../src/tasks/tasks.controller';
import { TasksService } from '../src/tasks/tasks.service';
import { createValidationPipe } from '../src/validation';

describe('API contract validation (e2e)', () => {
  let app: INestApplication<App>;
  const id = '1d813fc8-229d-4f66-83ad-72fd7d5b1254';
  const service = {
    create: jest.fn((body: unknown) => body),
    findAll: jest.fn((query: unknown) => query),
    findOne: jest.fn((taskId: string) => ({ id: taskId })),
    update: jest.fn(),
    remove: jest.fn(),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [TasksController],
      providers: [{ provide: TasksService, useValue: service }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(PermissionsGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(createValidationPipe());
    await app.init();
  });

  it('accepts and forwards only a valid request DTO', async () => {
    const body = {
      title: 'Ship contract',
      status: 'IN_PROGRESS',
      assigneeIds: [id],
    };

    await request(app.getHttpServer()).post('/tasks').send(body).expect(201).expect(body);
    expect(service.create).toHaveBeenCalledWith(body);
  });

  it('rejects unknown body fields before service/Prisma', async () => {
    await request(app.getHttpServer())
      .post('/tasks')
      .send({ title: 'Ship contract', injected: true })
      .expect(400)
      .expect(({ body }) => {
        expect(body.message).toContain('property injected should not exist');
      });
    expect(service.create).not.toHaveBeenCalledWith(expect.objectContaining({ injected: true }));
  });

  it('rejects invalid enum query values', async () => {
    await request(app.getHttpServer()).get('/tasks?status=NOT_A_STATUS').expect(400);
  });

  it('rejects malformed UUID path parameters', async () => {
    await request(app.getHttpServer()).get('/tasks/not-a-uuid').expect(400);
    expect(service.findOne).not.toHaveBeenCalledWith('not-a-uuid');
  });

  it('accepts valid UUID path parameters', async () => {
    await request(app.getHttpServer()).get(`/tasks/${id}`).expect(200).expect({ id });
  });

  afterAll(async () => {
    await app.close();
  });
});
