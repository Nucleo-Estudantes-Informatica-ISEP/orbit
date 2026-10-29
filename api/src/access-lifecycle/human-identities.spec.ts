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
      (await service.execute(op('DISCORD', member.user.id))).status,
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

  it('upgrades a direct reader permission to writer and verifies the resulting role', async () => {
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
        return { mimeType: 'application/vnd.google-apps.folder' };
      },
    );
    expect(
      (await service.execute(op('GOOGLE_DRIVE', 'person@example.com'))).status,
    ).toBe('SUCCEEDED');
    expect(
      http.request.mock.calls.some((c: unknown[]) => c[2] === 'PATCH'),
    ).toBe(true);
  });
});
