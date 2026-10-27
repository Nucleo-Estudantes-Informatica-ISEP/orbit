import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { LifecycleController } from '../src/access-lifecycle/lifecycle.controller';
import { LifecycleService } from '../src/access-lifecycle/lifecycle.service';
import { JwtAuthGuard } from '../src/auth/jwt-auth.guard';
import { createValidationPipe } from '../src/validation';

describe('Access lifecycle HTTP validation', () => {
  let app: INestApplication<App>;
  const actorId = '07192922-d7c6-40d0-bb1f-4a17ce045e83';
  const service = {
    create: jest.fn().mockResolvedValue({ id: actorId }),
    decide: jest.fn().mockResolvedValue({ id: actorId }),
  };
  const valid = {
    kind: 'ONBOARD',
    targetName: 'Pessoa',
    targetEmail: 'person@example.com',
    targetDepartmentIds: [actorId],
    targetPositions: ['MEMBER'],
    reason: 'Pedido de onboarding',
    sourceNote: 'Forms consultado manualmente',
    selectedOperations: [{ resourceId: actorId, action: 'GRANT' }],
  };
  beforeAll(async () => {
    const fixture = await Test.createTestingModule({
      controllers: [LifecycleController],
      providers: [{ provide: LifecycleService, useValue: service }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate(context: {
          switchToHttp(): { getRequest(): { user?: unknown } };
        }) {
          context.switchToHttp().getRequest().user = { userId: actorId };
          return true;
        },
      })
      .compile();
    app = fixture.createNestApplication();
    app.useGlobalPipes(createValidationPipe());
    await app.init();
  });
  afterAll(async () => {
    await app.close();
  });

  it('attributes creation only to the authenticated operator', async () => {
    await request(app.getHttpServer())
      .post('/access-lifecycle/processes')
      .send(valid)
      .expect(201);
    expect(service.create).toHaveBeenCalledWith(
      actorId,
      expect.objectContaining({ targetEmail: 'person@example.com' }),
    );
  });
  it('rejects forged requester, approver and nested verification flags', async () => {
    await request(app.getHttpServer())
      .post('/access-lifecycle/processes')
      .send({ ...valid, requestedByUserId: actorId })
      .expect(400);
    await request(app.getHttpServer())
      .post(`/access-lifecycle/processes/${actorId}/decision`)
      .send({ approved: true, note: 'Validar pedido', decidedById: actorId })
      .expect(400);
    await request(app.getHttpServer())
      .post('/access-lifecycle/processes')
      .send({
        ...valid,
        selectedOperations: [
          { ...valid.selectedOperations[0], verified: true },
        ],
      })
      .expect(400);
  });
  it('rejects invalid IDs, unknown platforms, excessive operations and non-HTTPS admin links', async () => {
    await request(app.getHttpServer())
      .post('/access-lifecycle/processes')
      .send({ ...valid, targetDepartmentIds: ['other'] })
      .expect(400);
    await request(app.getHttpServer())
      .post('/access-lifecycle/processes')
      .send({
        ...valid,
        selectedOperations: Array.from(
          { length: 101 },
          () => valid.selectedOperations[0],
        ),
      })
      .expect(400);
    await request(app.getHttpServer())
      .post('/access-lifecycle/resources')
      .send({
        name: 'resource',
        provider: 'UNKNOWN',
        remoteId: 'id',
        resourceType: 'MANUAL',
        automatic: false,
        sensitive: false,
        enabled: true,
        departmentIds: [],
        instructions: '',
        adminUrl: 'javascript:alert(1)',
      })
      .expect(400);
    await request(app.getHttpServer())
      .post('/access-lifecycle/processes/invalid/decision')
      .send({ approved: true, note: 'Checked' })
      .expect(400);
  });
});
