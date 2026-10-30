import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { PrismaService } from '../src/prisma.service';

describe('Alumni contact migration (PostgreSQL)', () => {
  const prisma = new PrismaService();
  const stockId = 'f3e655c1-ed39-4046-a922-f11b71462c62';
  const migration = readFileSync(
    join(
      __dirname,
      '../prisma/migrations/20261030154500_access_alumni_contact/migration.sql',
    ),
    'utf8',
  );

  beforeAll(() => prisma.$connect());
  afterAll(() => prisma.$disconnect());

  it('restores only the unchanged legacy WhatsApp Alumni step and preserves operator edits', async () => {
    const rollback = new Error('Rollback test fixture');
    await expect(
      prisma.$transaction(async (tx) => {
        const customId = randomUUID();
        const data = {
          name: 'WhatsApp test',
          provider: 'WHATSAPP' as const,
          remoteId: 'CONFIGURE_ME',
          resourceType: 'WHATSAPP_GROUP',
          enabled: false,
          automatic: false,
          version: 1,
          instructions: 'Previous default',
        };
        await tx.accessResource.upsert({
          where: { id: stockId },
          create: { id: stockId, ...data },
          update: data,
        });
        await tx.accessResource.create({ data: { id: customId, ...data } });
        await tx.$executeRawUnsafe(migration);
        expect(
          await tx.accessResource.findUniqueOrThrow({ where: { id: stockId } }),
        ).toMatchObject({ enabled: true, automatic: false, version: 2 });
        expect(
          await tx.accessResource.findUniqueOrThrow({
            where: { id: customId },
          }),
        ).toMatchObject({ enabled: false, version: 1 });

        await tx.accessResource.update({
          where: { id: stockId },
          data: { enabled: false, instructions: 'Operator choice', version: 3 },
        });
        await tx.$executeRawUnsafe(migration);
        expect(
          await tx.accessResource.findUniqueOrThrow({ where: { id: stockId } }),
        ).toMatchObject({
          enabled: false,
          instructions: 'Operator choice',
          version: 3,
        });

        await tx.accessResource.update({
          where: { id: stockId },
          data: { remoteId: 'configured-group', version: 1 },
        });
        await tx.$executeRawUnsafe(migration);
        expect(
          await tx.accessResource.findUniqueOrThrow({ where: { id: stockId } }),
        ).toMatchObject({
          enabled: false,
          remoteId: 'configured-group',
          version: 1,
        });
        throw rollback;
      }),
    ).rejects.toBe(rollback);
  });
});
