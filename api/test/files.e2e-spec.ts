import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Readable } from 'node:stream';
import request from 'supertest';
import { App } from 'supertest/types';
import { JwtAuthGuard } from '../src/auth/jwt-auth.guard';
import { FilesController } from '../src/files/files.controller';
import { MinioService } from '../src/files/minio.service';
import { createValidationPipe } from '../src/validation';

describe('File downloads (e2e)', () => {
  let app: INestApplication<App>;
  const minio = {
    getObjectStat: jest.fn(() =>
      Promise.resolve({
        size: 4,
        metaData: { 'content-type': 'application/pdf' },
      }),
    ),
    getObject: jest.fn(() =>
      Promise.resolve(Readable.from([Buffer.from('test')])),
    ),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [FilesController],
      providers: [{ provide: MinioService, useValue: minio }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(createValidationPipe());
    await app.init();
  });

  it('normalizes an Express wildcard array into a slash-joined object key', async () => {
    await request(app.getHttpServer())
      .get('/files/folder/sample.pdf')
      .expect(200)
      .expect('Content-Type', /application\/pdf/)
      .expect(Buffer.from('test'));

    expect(minio.getObjectStat).toHaveBeenCalledWith('folder/sample.pdf');
    expect(minio.getObject).toHaveBeenCalledWith('folder/sample.pdf');
  });

  afterAll(async () => {
    await app.close();
  });
});
