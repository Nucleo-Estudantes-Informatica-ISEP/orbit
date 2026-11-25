import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Readable } from 'node:stream';
import request from 'supertest';
import { App } from 'supertest/types';
import { JwtAuthGuard } from '../src/auth/jwt-auth.guard';
import { FilesController } from '../src/files/files.controller';
import { MinioService } from '../src/files/minio.service';
import { PrismaService } from '../src/prisma.service';
import { createValidationPipe } from '../src/validation';

describe('File downloads (e2e)', () => {
  let app: INestApplication<App>;
  const minio = {
    listObjects: jest.fn().mockResolvedValue([
      { name: 'first.pdf', size: 4, lastModified: new Date(2) },
      { name: 'second.pdf', size: 4, lastModified: new Date(1) },
    ]),
    getObjectStat: jest.fn((key: string) =>
      Promise.resolve({
        size: 4,
        contentType: key.endsWith('.svg')
          ? 'image/svg+xml'
          : key.endsWith('.html')
            ? 'text/html'
            : 'application/pdf',
      }),
    ),
    getObject: jest.fn(() =>
      Promise.resolve(Readable.from([Buffer.from('test')])),
    ),
    deleteObject: jest.fn().mockResolvedValue(undefined),
  };
  const queries = {
    uploadedFile: {
      findUnique: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
    },
    $queryRaw: jest.fn().mockResolvedValue([{ snapshot: 'initial' }]),
    debt: { findMany: jest.fn().mockResolvedValue([]) },
    incident: { findMany: jest.fn().mockResolvedValue([]) },
    inventoryItem: { findMany: jest.fn().mockResolvedValue([]) },
    plan: { findMany: jest.fn().mockResolvedValue([]) },
    candidate: { findMany: jest.fn().mockResolvedValue([]) },
    resource: { findMany: jest.fn().mockResolvedValue([]) },
    $executeRaw: jest.fn().mockResolvedValue(0),
  };
  const prisma = {
    ...queries,
    $transaction: jest.fn(
      (callback: (tx: typeof queries) => Promise<unknown>) => callback(queries),
    ),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [FilesController],
      providers: [
        { provide: MinioService, useValue: minio },
        { provide: PrismaService, useValue: prisma },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate(context: {
          switchToHttp(): { getRequest(): { user: unknown } };
        }) {
          context.switchToHttp().getRequest().user = {
            userId: 'reader',
            roles: [],
            permissions: ['FILES_VIEW', 'FILES_DELETE', 'FILES_UPLOAD'],
            email: 'reader@example.test',
          };
          return true;
        },
      })
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
          new RegExp(`^attachment; filename\\*=UTF-8''${key}`),
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

  it('applies the parent record permission before contacting storage', async () => {
    prisma.debt.findMany.mockResolvedValueOnce([
      { fileKeys: ['restricted.pdf'] },
    ]);
    minio.getObjectStat.mockClear();
    await request(app.getHttpServer()).get('/files/restricted.pdf').expect(404);
    expect(minio.getObjectStat).not.toHaveBeenCalled();
  });

  it('allows library reads of detached ownerless files and preserves existing ownership restrictions', async () => {
    const ownerless = { uploadedById: null, attached: true, deletedAt: null };
    prisma.uploadedFile.findUnique.mockResolvedValueOnce(ownerless);
    await request(app.getHttpServer()).get('/files/legacy.pdf').expect(200);

    prisma.uploadedFile.findUnique.mockResolvedValueOnce(ownerless);
    prisma.debt.findMany.mockResolvedValueOnce([{ fileKeys: ['legacy.pdf'] }]);
    await request(app.getHttpServer()).get('/files/legacy.pdf').expect(404);

    prisma.uploadedFile.findUnique.mockResolvedValueOnce(ownerless);
    prisma.candidate.findMany.mockResolvedValueOnce([
      { cvUrl: '/api/files/folder%2flegacy.pdf?download=1' },
    ]);
    await request(app.getHttpServer())
      .get('/files/folder/legacy.pdf')
      .expect(404);

    prisma.uploadedFile.findUnique.mockResolvedValueOnce({
      uploadedById: 'other-user',
      attached: false,
      deletedAt: null,
    });
    await request(app.getHttpServer()).get('/files/private.pdf').expect(404);

    prisma.uploadedFile.findUnique.mockResolvedValueOnce({
      ...ownerless,
      attached: false,
    });
    await request(app.getHttpServer())
      .get('/files/deleted-owner.pdf')
      .expect(404);
  });

  it('preserves the object while a parent still references it', async () => {
    prisma.debt.findMany.mockResolvedValueOnce([
      { fileKeys: ['attached.pdf'] },
    ]);
    await request(app.getHttpServer())
      .delete('/files/attached.pdf')
      .expect(409);
    expect(minio.deleteObject).not.toHaveBeenCalled();
  });

  it('reuses visibility across pages and recomputes it after a database write', async () => {
    prisma.uploadedFile.findMany.mockClear();
    await request(app.getHttpServer())
      .get('/files?pageSize=1')
      .expect(200)
      .expect(({ body }) =>
        expect(body).toMatchObject({
          total: 2,
          items: [{ name: 'first.pdf' }],
        }),
      );
    await request(app.getHttpServer())
      .get('/files?page=2&pageSize=1')
      .expect(200)
      .expect(({ body }) =>
        expect(body).toMatchObject({
          total: 2,
          items: [{ name: 'second.pdf' }],
        }),
      );
    expect(prisma.uploadedFile.findMany).toHaveBeenCalledTimes(1);

    prisma.$queryRaw.mockResolvedValueOnce([{ snapshot: 'after-write' }]);
    prisma.debt.findMany.mockResolvedValueOnce([{ fileKeys: ['first.pdf'] }]);
    await request(app.getHttpServer())
      .get('/files?pageSize=1')
      .expect(200)
      .expect(({ body }) =>
        expect(body).toMatchObject({
          total: 1,
          items: [{ name: 'second.pdf' }],
        }),
      );
    expect(prisma.uploadedFile.findMany).toHaveBeenCalledTimes(2);
  });

  it('rejects over-limit files at the multipart boundary', async () => {
    await request(app.getHttpServer())
      .post('/files/upload')
      .attach('file', Buffer.alloc(10 * 1024 * 1024 + 1), 'fixture.pdf')
      .expect(413);
  });

  it('indexes parent references once across inventory batches, including encoded legacy URLs', async () => {
    const legacy = {
      name: 'folder/my file.pdf',
      size: 4,
      lastModified: new Date(2),
    };
    minio.listObjects.mockResolvedValueOnce([
      legacy,
      ...Array.from({ length: 500 }, (_, id) => ({
        ...legacy,
        name: `file-${id}.pdf`,
        lastModified: new Date(1),
      })),
    ]);
    prisma.candidate.findMany
      .mockClear()
      .mockResolvedValueOnce([
        { cvUrl: '/api/files/folder%2Fmy%20file.pdf?download=1' },
      ]);
    await request(app.getHttpServer())
      .get('/files?pageSize=1')
      .expect(200)
      .expect(({ body }) =>
        expect(body).toMatchObject({
          total: 500,
          items: [{ name: 'file-0.pdf' }],
        }),
      );
    expect(prisma.candidate.findMany).toHaveBeenCalledTimes(1);
  });

  afterAll(async () => {
    await app.close();
  });
});
