import { ConnectorsService } from './connectors.service';
import { ProviderHttp } from './provider-http';
import type { AccessOperation } from '@prisma/client';

describe('external access connectors', () => {
  const http = { request: jest.fn(), github: jest.fn(), google: jest.fn() };
  const service = new ConnectorsService(http as unknown as ProviderHttp);
  const operation = (provider: string, resource: object, action = 'GRANT') =>
    ({
      provider,
      action,
      providerUserId: '123456789012345678',
      verificationNote: 'Identity checked against provider',
      accountEmail: 'person@example.com',
      resourceSnapshot: resource,
    }) as AccessOperation;
  beforeEach(() => {
    jest.resetAllMocks();
    http.github.mockResolvedValue('Bearer test');
    http.google.mockResolvedValue('Bearer test');
  });
  afterEach(() => {
    delete process.env.ACCESS_DISCORD_BOT_TOKEN;
  });

  it('waits for identity rather than provisioning by unverified email', async () => {
    const op = { ...operation('GITHUB', {}), providerUserId: null };
    expect((await service.execute(op)).status).toBe('AWAITING_ACCOUNT');
    expect(http.request).not.toHaveBeenCalled();
  });

  it('excludes bots from Discord access management', async () => {
    process.env.ACCESS_DISCORD_BOT_TOKEN = 'test';
    http.request
      .mockResolvedValueOnce({ id: '323456789012345678' })
      .mockResolvedValue({
        user: { id: '123456789012345678', bot: true },
        roles: [],
      });
    await expect(
      service.execute(
        operation('DISCORD', {
          remoteId: '223456789012345678',
          containerId: '323456789012345678',
        }),
      ),
    ).rejects.toThrow('DISCORD_BOT_EXCLUDED');
    expect(http.request).toHaveBeenCalledTimes(2);
  });

  it('does not treat an inaccessible Discord guild as a successful revocation', async () => {
    process.env.ACCESS_DISCORD_BOT_TOKEN = 'test';
    http.request.mockResolvedValueOnce(undefined);
    await expect(
      service.execute(
        operation(
          'DISCORD',
          { remoteId: '223456789012345678', containerId: '323456789012345678' },
          'REVOKE',
        ),
      ),
    ).rejects.toThrow('DISCORD_GUILD_UNVERIFIED');
  });

  it('does not change roles above the bot hierarchy', async () => {
    process.env.ACCESS_DISCORD_BOT_TOKEN = 'test';
    http.request
      .mockResolvedValueOnce({ id: '323456789012345678' })
      .mockResolvedValueOnce({ user: { id: '123456789012345678' }, roles: [] })
      .mockResolvedValueOnce([
        {
          id: '223456789012345678',
          position: 9,
          managed: false,
          permissions: '0',
        },
        {
          id: '423456789012345678',
          position: 5,
          managed: false,
          permissions: String(1n << 28n),
        },
      ])
      .mockResolvedValueOnce({ id: 'bot' })
      .mockResolvedValueOnce({ roles: ['423456789012345678'] });
    await expect(
      service.execute(
        operation('DISCORD', {
          remoteId: '223456789012345678',
          containerId: '323456789012345678',
        }),
      ),
    ).rejects.toThrow('DISCORD_ROLE_HIERARCHY');
    expect(
      http.request.mock.calls.every(
        (call) => !['PUT', 'DELETE'].includes(call[2]),
      ),
    ).toBe(true);
  });

  it('detects a GitHub remote account mismatch before invitations/removal', async () => {
    http.request.mockResolvedValue({ id: 456, login: 'someone-else' });
    await expect(
      service.execute(
        operation(
          'GITHUB',
          { resourceType: 'GITHUB_ORG', remoteId: 'test-org' },
          'REVOKE',
        ),
      ),
    ).rejects.toThrow('GITHUB_ACCOUNT_MISMATCH');
    expect(http.request).toHaveBeenCalledTimes(1);
  });

  it('keeps pending GitHub invitations pending and does not send duplicate invites', async () => {
    const op = {
      ...operation('GITHUB', {
        resourceType: 'GITHUB_ORG',
        remoteId: 'test-org',
      }),
      providerUserId: '123',
    };
    http.request
      .mockResolvedValueOnce({ id: 123, login: 'person' })
      .mockResolvedValueOnce({ state: 'pending', role: 'member' })
      .mockResolvedValueOnce({ state: 'pending', role: 'member' });
    expect((await service.execute(op)).status).toBe('AWAITING_ACCOUNT');
    expect(http.request.mock.calls.some((call) => call[2] === 'POST')).toBe(
      false,
    );
  });

  it('refuses to automate sensitive Drive folders without limited access', async () => {
    http.request.mockResolvedValue({
      mimeType: 'application/vnd.google-apps.folder',
      inheritedPermissionsDisabled: false,
    });
    expect(
      (
        await service.execute(
          operation(
            'GOOGLE_DRIVE',
            { remoteId: 'folder', sensitive: true },
            'REVOKE',
          ),
        )
      ).status,
    ).toBe('AWAITING_MANUAL');
    expect(http.request).toHaveBeenCalledTimes(1);
  });

  it('does not duplicate a GitHub invitation identified by its real login field', async () => {
    const op = {
      ...operation('GITHUB', {
        resourceType: 'GITHUB_ORG',
        remoteId: 'test-org',
      }),
      providerUserId: '123',
    };
    http.request
      .mockResolvedValueOnce({ id: 123, login: 'person' })
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce([{ id: 789, login: 'person' }])
      .mockResolvedValueOnce({ state: 'pending' });
    expect((await service.execute(op)).status).toBe('AWAITING_ACCOUNT');
    expect(
      http.request.mock.calls.some((call: unknown[]) => call[2] === 'POST'),
    ).toBe(false);
  });

  it('cancels GitHub invitations by verified account login, not invitation ID', async () => {
    const op = {
      ...operation(
        'GITHUB',
        { resourceType: 'GITHUB_ORG', remoteId: 'test-org' },
        'REVOKE',
      ),
      providerUserId: '123',
    };
    http.request
      .mockResolvedValueOnce({ id: 123, login: 'person' })
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce([{ id: 789, login: 'person' }])
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(undefined);
    expect((await service.execute(op)).status).toBe('SUCCEEDED');
    expect(http.request).toHaveBeenCalledWith(
      'https://api.github.com/orgs/test-org/invitations/789',
      'Bearer test',
      'DELETE',
    );
  });

  it('never accepts a Google email in place of the permission ID for revocation', async () => {
    await expect(
      service.execute({
        ...operation('GOOGLE_DRIVE', { remoteId: 'folder' }, 'REVOKE'),
        providerUserId: 'person@example.com',
      }),
    ).rejects.toThrow('DRIVE_REQUIRES_PERMISSION_ID');
    expect(http.request).not.toHaveBeenCalled();
  });

  it('detects an incorrect Drive permission ID instead of reporting a false revocation', async () => {
    http.request
      .mockResolvedValueOnce({ mimeType: 'application/vnd.google-apps.folder' })
      .mockResolvedValueOnce({
        permissions: [
          {
            id: '999',
            type: 'user',
            emailAddress: 'person@example.com',
            role: 'writer',
          },
        ],
      });
    await expect(
      service.execute(
        operation('GOOGLE_DRIVE', { remoteId: 'folder' }, 'REVOKE'),
      ),
    ).rejects.toThrow('DRIVE_ACCOUNT_MISMATCH');
    expect(
      http.request.mock.calls.some((call: unknown[]) => call[2] === 'DELETE'),
    ).toBe(false);
  });

  it('never reports inherited Drive access as revoked', async () => {
    http.request
      .mockResolvedValueOnce({ mimeType: 'application/vnd.google-apps.folder' })
      .mockResolvedValueOnce({
        permissions: [
          {
            id: '123456789012345678',
            type: 'user',
            role: 'reader',
            emailAddress: 'person@example.com',
            permissionDetails: [{ inherited: true }],
          },
        ],
      })
      .mockResolvedValueOnce({ files: [] });
    expect(
      (
        await service.execute(
          operation(
            'GOOGLE_DRIVE',
            { remoteId: 'folder', sensitive: false },
            'REVOKE',
          ),
        )
      ).status,
    ).toBe('AWAITING_MANUAL');
    expect(http.request.mock.calls.some((call) => call[2] === 'DELETE')).toBe(
      false,
    );
  });
});
