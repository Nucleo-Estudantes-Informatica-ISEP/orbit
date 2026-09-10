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
    getObjectStat: jest.fn((key: string) =>
      Promise.resolve({
        size: 4,
        metaData: {
          'content-type': key.endsWith('.svg')
            ? 'image/svg+xml'
            : key.endsWith('.html')
              ? 'text/html'
              : 'application/pdf',
        },
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

  it.each(['vector.svg', 'page.html'])(
    'forces active %s content to download without sniffing',
    async (key) => {
      await request(app.getHttpServer())
        .get(`/files/${key}`)
        .expect(200)
        .expect(
          'Content-Disposition',
          new RegExp(`^attachment; filename="${key}"`),
        )
        .expect('X-Content-Type-Options', 'nosniff');
    },
  );

  it('returns the shared error envelope for missing files', async () => {
    minio.getObjectStat.mockRejectedValueOnce(new Error('missing'));

    await request(app.getHttpServer())
      .get('/files/missing.pdf')
      .expect(404)
      .expect({
        statusCode: 404,
        message: 'Ficheiro não encontrado',
        error: 'Not Found',
      });
  });

  afterAll(async () => {
    await app.close();
  });
});
