import { ConnectorsService } from './connectors.service';
import { ProviderHttp } from './provider-http';
import type { AccessOperation } from '@prisma/client';

describe('person-facing external identities', () => {
  const http = { request: jest.fn(), github: jest.fn(), google: jest.fn() };
  const service = new ConnectorsService(http as unknown as ProviderHttp);
  const op = (provider: string, principal: string, action = 'GRANT') =>
    ({
      provider,
      providerUserId: principal,
      action,
      verificationNote: null,
      accountEmail: provider === 'GOOGLE_DRIVE' ? principal : null,
      resourceSnapshot: {
        remoteId: '223456789012345678',
        containerId: '323456789012345678',
        resourceType: provider === 'GITHUB' ? 'GITHUB_ORG' : 'DISCORD_ROLE',
      },
    }) as unknown as AccessOperation;
  beforeEach(() => {
    jest.resetAllMocks();
    http.github.mockResolvedValue('Bearer test');
    http.google.mockResolvedValue('Bearer test');
    process.env.ACCESS_DISCORD_BOT_TOKEN = 'test';
  });
  afterEach(() => {
    delete process.env.ACCESS_DISCORD_BOT_TOKEN;
    delete process.env.ACCESS_DISCORD_PRIVILEGED_GRANTS_ENABLED;
  });

  it.each(['@departed.person', 'departed.person', '@123456789012345678'])(
    'hands an unresolved Discord revocation of %s to manual evidence without claiming absence',
    async (username) => {
      http.request.mockResolvedValue([]);
      expect(
        await service.execute(op('DISCORD', username, 'REVOKE')),
      ).toMatchObject({
        status: 'AWAITING_MANUAL',
        accountName: username,
      });
      expect(http.request).toHaveBeenCalledTimes(1);
    },
  );

  it('hands an unresolved GitHub revocation to manual evidence rather than waiting for a new account', async () => {
    http.request.mockResolvedValue(undefined);
    expect(
      await service.execute(op('GITHUB', '@departed-person', 'REVOKE')),
    ).toMatchObject({
      status: 'AWAITING_MANUAL',
      accountName: '@departed-person',
    });
  });

  it('confirms a revocation without a write when the approved stable Discord ID is absent from the verified guild', async () => {
    const approvedId = '123456789012345678';
    http.request
      .mockResolvedValueOnce({ id: '323456789012345678' })
      .mockResolvedValueOnce(undefined);
    expect(
      await service.execute(op('DISCORD', approvedId, 'REVOKE')),
    ).toMatchObject({
      status: 'SUCCEEDED',
      remoteId: approvedId,
    });
    expect(http.request).toHaveBeenCalledTimes(2);
  });

  it('does not turn a failed Discord lookup into a manual absence claim', async () => {
    const error = new Error('Provider unavailable');
    http.request.mockRejectedValue(error);
    await expect(
      service.execute(op('DISCORD', '@departed.person', 'REVOKE')),
    ).rejects.toBe(error);
  });

  function administrativeRoleFixture(permissions: bigint, targetPosition = 4) {
    const member = {
      user: { id: '123456789012345678' },
      roles: [] as string[],
    };
    http.request.mockImplementation(
      (url: string, _token: string, method = 'GET') => {
        if (url.endsWith('/users/@me')) return { id: '423456789012345678' };
        if (url.endsWith('/members/423456789012345678'))
          return { roles: ['523456789012345678'] };
        if (url.endsWith('/roles'))
          return [
            {
              id: '223456789012345678',
              position: targetPosition,
              managed: false,
              permissions: String(permissions),
            },
            {
              id: '523456789012345678',
              position: 10,
              managed: false,
              permissions: '8',
            },
          ];
        if (method === 'PUT') {
          member.roles.push('223456789012345678');
          return;
        }
        if (method === 'DELETE') {
          member.roles = [];
          return;
        }
        if (url.endsWith('/members/123456789012345678')) return member;
        return { id: '323456789012345678' };
      },
    );
    const operation = {
      ...op('DISCORD', member.user.id),
      resourceSnapshot: {
        ...(op('DISCORD', member.user.id).resourceSnapshot as object),
        sensitive: true,
      },
    };
    return { operation, member };
  }

  it.each([8n, 1n << 5n, 1n << 28n])(
    'requires a separate deployment opt-in before granting administrative permission %s',
    async (permissions) => {
      const { operation } = administrativeRoleFixture(permissions);
      delete process.env.ACCESS_DISCORD_PRIVILEGED_GRANTS_ENABLED;
      expect((await service.execute(operation)).status).toBe('AWAITING_MANUAL');
      expect(
        http.request.mock.calls.some((call: unknown[]) =>
          ['PUT', 'DELETE'].includes(String(call[2])),
        ),
      ).toBe(false);
    },
  );

  it.each([8n, 1n << 5n, 1n << 28n])(
    'grants administrative permission %s only after explicit opt-in and successful hierarchy checks',
    async (permissions) => {
      process.env.ACCESS_DISCORD_PRIVILEGED_GRANTS_ENABLED = 'true';
      const { operation, member } = administrativeRoleFixture(permissions);
      expect((await service.execute(operation)).status).toBe('SUCCEEDED');
      expect(member.roles).toContain('223456789012345678');
    },
  );

  it('offers manual hand-off without role writes when privileged grants are disabled and the bot is below the target', async () => {
    delete process.env.ACCESS_DISCORD_PRIVILEGED_GRANTS_ENABLED;
    const { operation } = administrativeRoleFixture(8n, 11);
    expect((await service.execute(operation)).status).toBe('AWAITING_MANUAL');
    expect(
      http.request.mock.calls.some((call: unknown[]) =>
        ['PUT', 'DELETE'].includes(String(call[2])),
      ),
    ).toBe(false);
  });

  it('can verify an existing administrative grant without opting into new grants', async () => {
    delete process.env.ACCESS_DISCORD_PRIVILEGED_GRANTS_ENABLED;
    const { operation, member } = administrativeRoleFixture(8n);
    member.roles.push('223456789012345678');
    expect((await service.execute(operation)).status).toBe('SUCCEEDED');
    expect(
      http.request.mock.calls.some((call: unknown[]) =>
        ['PUT', 'DELETE'].includes(String(call[2])),
      ),
    ).toBe(false);
  });

  it.each([8n, 1n << 5n, 1n << 28n])(
    'keeps hierarchy enforcement for privileged permission %s even after opting in',
    async (permissions) => {
      process.env.ACCESS_DISCORD_PRIVILEGED_GRANTS_ENABLED = 'true';
      const { operation } = administrativeRoleFixture(permissions, 11);
      await expect(service.execute(operation)).rejects.toThrow(
        'DISCORD_ROLE_HIERARCHY',
      );
      expect(
        http.request.mock.calls.some((call: unknown[]) =>
          ['PUT', 'DELETE'].includes(String(call[2])),
        ),
      ).toBe(false);
    },
  );

  it('does not block approved privileged role revocations when privileged grants are disabled', async () => {
    delete process.env.ACCESS_DISCORD_PRIVILEGED_GRANTS_ENABLED;
    const { operation, member } = administrativeRoleFixture(8n);
    member.roles.push('223456789012345678');
    expect(
      (await service.execute({ ...operation, action: 'REVOKE' })).status,
    ).toBe('SUCCEEDED');
    expect(
      http.request.mock.calls.some((call: unknown[]) => call[2] === 'DELETE'),
    ).toBe(true);
  });

  it('resolves only an exact Discord username, never a matching nickname', async () => {
    http.request.mockResolvedValue([
      {
        user: { id: '123456789012345678', username: 'person' },
        nick: 'Another name',
      },
      {
        user: { id: '923456789012345678', username: 'someone' },
        nick: 'person',
      },
    ]);
    expect(
      await service.resolveIdentity(op('DISCORD', '@person')),
    ).toMatchObject({ providerUserId: '123456789012345678' });
    expect((http.request.mock.calls as unknown[][])[0][0]).toContain(
      '/members/search?query=person&limit=1000',
    );
  });

  it('leaves a Discord username awaiting server entry without choosing a nickname', async () => {
    http.request.mockResolvedValue([
      {
        user: { id: '923456789012345678', username: 'someone' },
        nick: 'person',
      },
    ]);
    expect(
      await service.resolveIdentity(op('DISCORD', 'person')),
    ).toMatchObject({ providerUserId: 'person' });
  });

  it('resolves GitHub username to its stable ID without human verification notes', async () => {
    http.request.mockResolvedValue({ id: 123, login: 'Person' });
    expect(await service.resolveIdentity(op('GITHUB', 'person'))).toMatchObject(
      { providerUserId: '123' },
    );
    expect((http.request.mock.calls as unknown[][])[0][0]).toBe(
      'https://api.github.com/users/person',
    );
  });

  it('resolves an explicit numeric GitHub username without treating it as a legacy account ID', async () => {
    http.request.mockResolvedValue({ id: 456, login: '123' });
    expect(await service.resolveIdentity(op('GITHUB', '@123'))).toMatchObject({
      providerUserId: '456',
    });
    expect((http.request.mock.calls as unknown[][])[0][0]).toBe(
      'https://api.github.com/users/123',
    );
  });

  it('keeps an unresolved numeric Discord username pending instead of targeting that numeric ID', async () => {
    http.request.mockResolvedValue([]);
    expect(
      (await service.execute(op('DISCORD', '@123456789012345678'))).status,
    ).toBe('AWAITING_ACCOUNT');
    expect(http.request).toHaveBeenCalledTimes(1);
  });

  it('rejects an ambiguous exact Discord match', async () => {
    http.request.mockResolvedValue([
      { user: { id: '123456789012345678', username: 'person' } },
      { user: { id: '923456789012345678', username: 'person' } },
    ]);
    await expect(
      service.resolveIdentity(op('DISCORD', 'person')),
    ).rejects.toThrow('DISCORD_AMBIGUOUS_USERNAME');
  });

  it('automates an approved administrative Discord role below the bot', async () => {
    process.env.ACCESS_DISCORD_PRIVILEGED_GRANTS_ENABLED = 'true';
    const member = {
      user: { id: '123456789012345678' },
      roles: [] as string[],
    };
    http.request.mockImplementation(
      (url: string, _token: string, method = 'GET') => {
        if (url.endsWith('/users/@me')) return { id: '423456789012345678' };
        if (url.endsWith('/members/423456789012345678'))
          return { roles: ['523456789012345678'] };
        if (url.endsWith('/roles'))
          return [
            {
              id: '223456789012345678',
              position: 4,
              managed: false,
              permissions: '8',
            },
            {
              id: '523456789012345678',
              position: 10,
              managed: false,
              permissions: '8',
            },
          ];
        if (method === 'PUT') {
          member.roles.push('223456789012345678');
          return;
        }
        if (url.endsWith('/members/123456789012345678')) return member;
        return { id: '323456789012345678' };
      },
    );
    expect(
      (
        await service.execute({
          ...op('DISCORD', member.user.id),
          resourceSnapshot: {
            ...(op('DISCORD', member.user.id).resourceSnapshot as object),
            sensitive: true,
          },
        })
      ).status,
    ).toBe('SUCCEEDED');
    expect(http.request.mock.calls.some((c: unknown[]) => c[2] === 'PUT')).toBe(
      true,
    );
  });

  it('revokes a Google user by email and discovers the permission ID internally', async () => {
    let present = true;
    http.request.mockImplementation(
      (url: string, _token: string, method = 'GET') => {
        if (method === 'DELETE') {
          present = false;
          return;
        }
        if (url.includes('/permissions?'))
          return {
            permissions: present
              ? [
                  {
                    id: '456',
                    type: 'user',
                    role: 'writer',
                    emailAddress: 'person@example.com',
                  },
                ]
              : [],
          };
        if (url.includes('/drive/v3/files?')) return { files: [] };
        return { mimeType: 'application/vnd.google-apps.folder' };
      },
    );
    expect(
      (
        await service.execute(
          op('GOOGLE_DRIVE', 'person@example.com', 'REVOKE'),
        )
      ).status,
    ).toBe('SUCCEEDED');
    expect(
      http.request.mock.calls.some(
        (c: unknown[]) =>
          String(c[0]).includes('/permissions/456?') && c[2] === 'DELETE',
      ),
    ).toBe(true);
  });

  it.each(['8', '32', String(1n << 28n)])(
    'blocks an administrative Discord permission %s without a sensitive resource',
    async (permissions) => {
      const member = { user: { id: '123456789012345678' }, roles: [] };
      http.request.mockImplementation((url: string) => {
        if (url.endsWith('/roles'))
          return [
            {
              id: '223456789012345678',
              position: 4,
              managed: false,
              permissions,
            },
            {
              id: '523456789012345678',
              position: 10,
              managed: false,
              permissions: '8',
            },
          ];
        if (url.endsWith('/users/@me')) return { id: '423456789012345678' };
        if (url.endsWith('/members/423456789012345678'))
          return { roles: ['523456789012345678'] };
        if (url.endsWith('/members/' + member.user.id)) return member;
        return { id: '323456789012345678' };
      });
      await expect(
        service.execute(op('DISCORD', member.user.id)),
      ).rejects.toThrow('DISCORD_PROTECTED_ROLE');
      expect(
        http.request.mock.calls.some((call: unknown[]) => call[2] === 'PUT'),
      ).toBe(false);
    },
  );

  it('checks permission bits when saving a configured automatic Discord resource', async () => {
    http.request.mockResolvedValue([
      {
        id: '223456789012345678',
        position: 4,
        managed: false,
        permissions: '8',
      },
    ]);
    const resource = {
      ...(op('DISCORD', 'person').resourceSnapshot as object),
      provider: 'DISCORD',
      enabled: true,
      automatic: true,
      sensitive: false,
    } as Parameters<ConnectorsService['validateDiscordResource']>[0];
    await expect(service.validateDiscordResource(resource)).rejects.toThrow(
      'DISCORD_PROTECTED_ROLE',
    );
    await expect(
      service.validateDiscordResource({ ...resource, sensitive: true }),
    ).resolves.toBeUndefined();
  });

  it.each([
    { id: 'group', type: 'group', role: 'reader' },
    { id: 'domain', type: 'domain', role: 'reader' },
    { id: 'link', type: 'anyone', role: 'reader' },
    {
      id: 'inherited',
      type: 'user',
      role: 'reader',
      permissionDetails: [{ inherited: true }],
    },
  ])(
    'audits indirect access $id before granting a sensitive Drive folder',
    async (permission) => {
      http.request
        .mockResolvedValueOnce({
          mimeType: 'application/vnd.google-apps.folder',
          inheritedPermissionsDisabled: false,
        })
        .mockResolvedValueOnce({ permissions: [permission] });
      const operation = op('GOOGLE_DRIVE', 'person@example.com');
      operation.resourceSnapshot = {
        ...(operation.resourceSnapshot as object),
        sensitive: true,
      };
      expect((await service.execute(operation)).status).toBe('AWAITING_MANUAL');
      expect(
        http.request.mock.calls.some((call: unknown[]) =>
          ['POST', 'PATCH', 'DELETE'].includes(String(call[2])),
        ),
      ).toBe(false);
    },
  );

  it.each([false, true])(
    'upgrades direct read access automatically, including a sensitive=%s folder with no indirect access',
    async (sensitive) => {
      let role = 'reader';
      http.request.mockImplementation(
        (url: string, _token: string, method = 'GET') => {
          if (method === 'PATCH') {
            role = 'writer';
            return { id: '456', role };
          }
          if (url.includes('/permissions?'))
            return {
              permissions: [
                {
                  id: '456',
                  type: 'user',
                  role,
                  emailAddress: 'person@example.com',
                },
              ],
            };
          return {
            mimeType: 'application/vnd.google-apps.folder',
            inheritedPermissionsDisabled: false,
          };
        },
      );
      expect(
        (
          await service.execute({
            ...op('GOOGLE_DRIVE', 'person@example.com'),
            resourceSnapshot: {
              ...(op('GOOGLE_DRIVE', 'person@example.com')
                .resourceSnapshot as object),
              sensitive,
            },
          })
        ).status,
      ).toBe('SUCCEEDED');
      expect(
        http.request.mock.calls.some((c: unknown[]) => c[2] === 'PATCH'),
      ).toBe(true);
    },
  );
});
