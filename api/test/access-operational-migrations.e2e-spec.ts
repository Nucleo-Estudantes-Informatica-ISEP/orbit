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

describe('Operational resource migration scope (PostgreSQL)', () => {
  const prisma = new PrismaService();
  const ids = [
    'a8b1a10f-49a5-47a3-aa55-731d2cb3088f',
    '5b08139b-9c69-4e69-aa54-649bf3539cbc',
    '1948a016-81f2-408e-a6cb-0ffe91601769',
    'c16de9e7-6933-4956-a119-c23be1f5fcea',
    '91091a77-0190-4465-ad84-2f5cd81ab626',
  ];
  const operationalUpdate = readFileSync(
    join(
      __dirname,
      '../prisma/migrations/20261029113000_access_operational_defaults/migration.sql',
    ),
    'utf8',
  ).split('-- Stock manual steps')[0];
  beforeAll(() => prisma.$connect());
  afterAll(() => prisma.$disconnect());

  it('changes only configured enabled manual stock rows, preserving existing automatic choices and unrelated rows', async () => {
    const rollback = new Error('Rollback migration scope fixtures');
    await expect(
      prisma.$transaction(async (tx) => {
        for (const [index, id] of ids.entries()) {
          const data = {
            name: `Operational test ${index}`,
            provider: 'DISCORD' as const,
            resourceType: 'DISCORD_ROLE',
            remoteId: index === 3 ? 'CONFIGURE_ME' : 'configured-role',
            enabled: index !== 2,
            automatic: index === 1,
            sensitive: true,
            version: 5,
          };
          await tx.accessResource.upsert({
            where: { id },
            create: { id, ...data },
            update: data,
          });
        }
        const customId = randomUUID();
        await tx.accessResource.create({
          data: {
            id: customId,
            name: 'Custom manual resource',
            provider: 'DISCORD',
            resourceType: 'DISCORD_ROLE',
            remoteId: 'configured-role',
            automatic: false,
            version: 5,
          },
        });
        await tx.$executeRawUnsafe(operationalUpdate);
        const rows = await tx.accessResource.findMany({
          where: { id: { in: [...ids, customId] } },
        });
        const byId = new Map(rows.map((row) => [row.id, row]));
        expect(byId.get(ids[0])).toMatchObject({ automatic: true, version: 6 });
        expect(byId.get(ids[4])).toMatchObject({ automatic: true, version: 6 });
        expect(byId.get(ids[1])).toMatchObject({ automatic: true, version: 5 });
        expect(byId.get(ids[2])).toMatchObject({
          automatic: false,
          enabled: false,
          version: 5,
        });
        expect(byId.get(ids[3])).toMatchObject({
          automatic: false,
          remoteId: 'CONFIGURE_ME',
          version: 5,
        });
        expect(byId.get(customId)).toMatchObject({
          automatic: false,
          version: 5,
        });
        // Reapplying this correction does not bump already automatic versions.
        await tx.$executeRawUnsafe(operationalUpdate);
        expect(
          await tx.accessResource.findMany({
            where: { id: { in: [...ids, customId] } },
            orderBy: { id: 'asc' },
          }),
        ).toEqual([...rows].sort((a, b) => a.id.localeCompare(b.id)));
        throw rollback;
      }),
    ).rejects.toBe(rollback);
  });
});
