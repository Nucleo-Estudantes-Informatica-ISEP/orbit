import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { accessSeedMarkerId, seedAccessDefaults } from '../prisma/seed.access';
import type { AccessBootstrap } from '../src/access-lifecycle/bootstrap.config';

describe('Atomic access initialization (PostgreSQL)', () => {
  const root = new PrismaClient();
  let prisma: PrismaClient;
  let schema: string;

  beforeAll(() => root.$connect());
  afterAll(() => root.$disconnect());
  beforeEach(async () => {
    // Isolate stock IDs and first-initialization state from other E2E suites.
    schema = `access_seed_${randomUUID().replace(/-/g, '')}`;
    const url = new URL(process.env.DATABASE_URL!);
    await root.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
    url.searchParams.set('schema', schema);
    prisma = new PrismaClient({ datasourceUrl: url.toString() });
    // Use real migrations, including PostgreSQL enum namespaces and relations.
    execFileSync(
      process.execPath,
      [
        require.resolve('prisma/build/index.js'),
        'migrate',
        'deploy',
        '--schema',
        join(__dirname, '../prisma/schema.prisma'),
      ],
      {
        env: { ...process.env, DATABASE_URL: url.toString() },
        stdio: 'pipe',
        timeout: 45_000,
      },
    );
    await prisma.role.create({
      data: { name: 'ADMIN', permissions: ['USERS_READ'] },
    });
    await prisma.department.create({
      data: { name: 'Infraestruturas Informáticas' },
    });
  }, 60_000);
  afterEach(async () => {
    await prisma?.$disconnect();
    await root.$executeRawUnsafe(`DROP SCHEMA "${schema}" CASCADE`);
  });

  it.each(['resource', 'role'])(
    'rolls back a failed %s bootstrap and completes on retry without losing ADMIN access',
    async (failure) => {
      const log = jest.fn();
      const invalid: AccessBootstrap =
        failure === 'resource'
          ? { resources: { figma: { automatic: true } } }
          : {
              resources: {},
              rolePermissions: { MISSING_ROLE: ['ACCESS_READ'] },
            };
      await expect(seedAccessDefaults(prisma, invalid, log)).rejects.toThrow(
        'Invalid access bootstrap',
      );
      expect(await prisma.accessResource.count()).toBe(0);
      expect(await prisma.accessPolicy.count()).toBe(0);
      expect(
        await prisma.auditLog.findUnique({ where: { id: accessSeedMarkerId } }),
      ).toBeNull();
      expect(
        (await prisma.role.findUniqueOrThrow({ where: { name: 'ADMIN' } }))
          .permissions,
      ).toEqual(['USERS_READ']);
      expect(log).not.toHaveBeenCalled();

      const config: AccessBootstrap = {
        resources: { figma: { remoteId: 'configured-team' } },
      };
      await seedAccessDefaults(prisma, config, log);
      const figma = await prisma.accessResource.findFirstOrThrow({
        where: { provider: 'FIGMA' },
      });
      expect(figma).toMatchObject({ remoteId: 'configured-team', version: 2 });
      expect(await prisma.accessPolicy.count()).toBeGreaterThan(0);
      const marker = await prisma.auditLog.findUniqueOrThrow({
        where: { id: accessSeedMarkerId },
      });
      expect(marker.action).toBe('ACCESS_DEFAULTS_INITIALIZED');
      expect(
        (await prisma.role.findUniqueOrThrow({ where: { name: 'ADMIN' } }))
          .permissions,
      ).toEqual(
        expect.arrayContaining(['USERS_READ', 'ACCESS_READ', 'ACCESS_APPROVE']),
      );

      // A later env change must not replace UI choices or reset role permissions.
      await prisma.accessResource.update({
        where: { id: figma.id },
        data: { remoteId: 'ui-team', automatic: false, version: 3 },
      });
      await prisma.role.update({
        where: { name: 'ADMIN' },
        data: { permissions: ['USERS_READ', 'ACCESS_READ'] },
      });
      await seedAccessDefaults(
        prisma,
        { ...config, rolePermissions: { ADMIN: ['ACCESS_MANAGE'] } },
        log,
      );
      expect(
        await prisma.accessResource.findUniqueOrThrow({
          where: { id: figma.id },
        }),
      ).toMatchObject({ remoteId: 'ui-team', version: 3 });
      expect(
        (await prisma.role.findUniqueOrThrow({ where: { name: 'ADMIN' } }))
          .permissions,
      ).toEqual(['USERS_READ', 'ACCESS_READ']);
      expect(
        await prisma.auditLog.findUniqueOrThrow({
          where: { id: accessSeedMarkerId },
        }),
      ).toEqual(marker);
      expect(log).toHaveBeenCalledWith(
        expect.stringContaining(
          'skipped 1 existing resource entries and 1 role entries',
        ),
      );
      expect(log.mock.calls.flat().join(' ')).not.toContain('configured-team');
    },
  );

  it('adopts a legacy catalogue without overwriting existing configuration or permissions', async () => {
    await prisma.accessResource.create({
      data: {
        id: 'legacy-custom',
        name: 'Custom team',
        provider: 'CODA',
        resourceType: 'MANUAL',
        remoteId: 'custom-team',
        automatic: false,
      },
    });
    await prisma.role.update({
      where: { name: 'ADMIN' },
      data: { permissions: ['ACCESS_READ'] },
    });
    const log = jest.fn();
    await seedAccessDefaults(
      prisma,
      { resources: {}, rolePermissions: { ADMIN: ['ACCESS_MANAGE'] } },
      log,
    );
    expect(
      (await prisma.role.findUniqueOrThrow({ where: { name: 'ADMIN' } }))
        .permissions,
    ).toEqual(['ACCESS_READ']);
    expect(
      (
        await prisma.accessResource.findUniqueOrThrow({
          where: { id: 'legacy-custom' },
        })
      ).remoteId,
    ).toBe('custom-team');
    expect(
      (
        await prisma.auditLog.findUniqueOrThrow({
          where: { id: accessSeedMarkerId },
        })
      ).action,
    ).toBe('ACCESS_DEFAULTS_LEGACY_ADOPTED');
    expect(log).toHaveBeenCalledWith(
      expect.stringContaining('adopted an existing catalogue'),
    );
  });
});
