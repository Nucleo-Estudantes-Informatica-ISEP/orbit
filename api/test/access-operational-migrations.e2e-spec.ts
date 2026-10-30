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

describe('Operational resource audit reconciliation (PostgreSQL)', () => {
  const prisma = new PrismaService();
  const ids = [
    'a8b1a10f-49a5-47a3-aa55-731d2cb3088f',
    '5b08139b-9c69-4e69-aa54-649bf3539cbc',
    '1948a016-81f2-408e-a6cb-0ffe91601769',
    'c16de9e7-6933-4956-a119-c23be1f5fcea',
    '91091a77-0190-4465-ad84-2f5cd81ab626',
  ];
  const migration = readFileSync(
    join(
      __dirname,
      '../prisma/migrations/20261030181500_access_operational_audit/migration.sql',
    ),
    'utf8',
  );
  const operationalUpdate = readFileSync(
    join(
      __dirname,
      '../prisma/migrations/20261029113000_access_operational_defaults/migration.sql',
    ),
    'utf8',
  ).split('-- Stock manual steps')[0];
  beforeAll(() => prisma.$connect());
  afterAll(() => prisma.$disconnect());

  it('audits the five automatic stock resources once and preserves later manual choices', async () => {
    const rollback = new Error('Rollback audit fixtures');
    await expect(
      prisma.$transaction(async (tx) => {
        for (const [index, id] of ids.entries()) {
          const data = {
            name: `Operational test ${index}`,
            provider: 'DISCORD' as const,
            resourceType: 'DISCORD_ROLE',
            remoteId: 'configured-role',
            enabled: true,
            automatic: false,
            sensitive: true,
            version: 5,
          };
          await tx.accessResource.upsert({
            where: { id },
            create: { id, ...data },
            update: data,
          });
        }
        await tx.$executeRawUnsafe(operationalUpdate);
        await tx.$executeRawUnsafe(migration);
        await tx.$executeRawUnsafe(migration);
        const audit = await tx.auditLog.findMany({
          where: {
            entity: 'AccessResource',
            entityId: { in: ids },
            action: 'ACCESS_OPERATIONAL_DEFAULTS_RECONCILED',
          },
        });
        expect(audit).toHaveLength(5);
        expect(new Set(audit.map((row) => row.entityId))).toEqual(new Set(ids));
        expect(audit.every((row) => row.performedById === null)).toBe(true);
        expect(
          await tx.accessResource.count({
            where: { id: { in: ids }, automatic: true, version: 6 },
          }),
        ).toBe(5);
        await tx.accessResource.update({
          where: { id: ids[0] },
          data: { automatic: false, version: 7 },
        });
        await tx.$executeRawUnsafe(migration);
        expect(
          await tx.accessResource.findUniqueOrThrow({ where: { id: ids[0] } }),
        ).toMatchObject({ automatic: false, version: 7 });
        throw rollback;
      }),
    ).rejects.toBe(rollback);
  });
});
