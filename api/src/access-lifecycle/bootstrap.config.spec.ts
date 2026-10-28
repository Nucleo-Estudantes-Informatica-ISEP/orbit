import { readAccessBootstrap, applyAccessBootstrap } from './bootstrap.config';
import type { PrismaClient } from '@prisma/client';

describe('access bootstrap configuration', () => {
  it('rejects unknown fields and permissions outside the access module', () => {
    expect(() =>
      readAccessBootstrap({
        ACCESS_BOOTSTRAP_RESOURCES: '{"figma":{"password":"secret"}}',
      }),
    ).toThrow('Invalid access bootstrap');
    expect(() =>
      readAccessBootstrap({
        ACCESS_BOOTSTRAP_ROLE_PERMISSIONS: '{"ADMIN":["USERS_DELETE"]}',
      }),
    ).toThrow('Invalid access bootstrap');
  });

  it('updates configured resources once and preserves every unrelated permission', async () => {
    const resource = {
      id: 'resource',
      name: 'Figma',
      provider: 'FIGMA',
      remoteId: 'team',
      automatic: false,
      enabled: false,
      version: 1,
    };
    const prisma = {
      accessResource: {
        findUnique: jest.fn().mockResolvedValue(resource),
        update: jest.fn(),
      },
      role: {
        findUnique: jest
          .fn()
          .mockResolvedValue({
            id: 'role',
            permissions: ['USERS_READ', 'ACCESS_APPROVE'],
          }),
        update: jest.fn(),
      },
      $transaction: jest.fn(),
    };
    prisma.$transaction.mockImplementation(
      (callback: (tx: typeof prisma) => unknown) => callback(prisma),
    );
    const config = readAccessBootstrap({
      ACCESS_BOOTSTRAP_RESOURCES:
        '{"figma":{"remoteId":"team","enabled":true}}',
      ACCESS_BOOTSTRAP_ROLE_PERMISSIONS:
        '{"SYS-ADMIN":["ACCESS_READ","ACCESS_MANAGE","ACCESS_ALL_DEPARTMENTS"]}',
    });
    await applyAccessBootstrap(
      prisma as unknown as PrismaClient,
      { figma: 'resource' },
      config,
    );
    expect(prisma.accessResource.update).toHaveBeenCalledWith({
      where: { id: 'resource' },
      data: { remoteId: 'team', enabled: true, version: { increment: 1 } },
    });
    expect(prisma.role.update).toHaveBeenCalledWith({
      where: { id: 'role' },
      data: {
        permissions: [
          'USERS_READ',
          'ACCESS_READ',
          'ACCESS_MANAGE',
          'ACCESS_ALL_DEPARTMENTS',
        ],
      },
    });
    prisma.accessResource.update.mockClear();
    prisma.accessResource.findUnique.mockResolvedValue({
      ...resource,
      enabled: true,
    });
    await applyAccessBootstrap(
      prisma as unknown as PrismaClient,
      { figma: 'resource' },
      config,
    );
    expect(prisma.accessResource.update).not.toHaveBeenCalled();
  });

  it('validates every resource before performing mutations', async () => {
    const prisma = {
      accessResource: {
        findUnique: jest
          .fn()
          .mockResolvedValue({
            id: 'resource',
            name: 'Figma',
            provider: 'FIGMA',
            remoteId: 'team',
            automatic: false,
          }),
        update: jest.fn(),
      },
      role: { findUnique: jest.fn() },
      $transaction: jest.fn(),
    };
    prisma.$transaction.mockImplementation(
      (callback: (tx: typeof prisma) => unknown) => callback(prisma),
    );
    const config = readAccessBootstrap({
      ACCESS_BOOTSTRAP_RESOURCES: '{"figma":{"automatic":true}}',
    });
    await expect(
      applyAccessBootstrap(
        prisma as unknown as PrismaClient,
        { figma: 'resource' },
        config,
      ),
    ).rejects.toThrow('Invalid access bootstrap');
    expect(prisma.accessResource.update).not.toHaveBeenCalled();
  });
});
