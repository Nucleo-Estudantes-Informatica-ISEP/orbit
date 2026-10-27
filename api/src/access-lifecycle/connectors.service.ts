import { Injectable } from '@nestjs/common';
import type { AccessOperation, AccessResource, Prisma } from '@prisma/client';
import { ProviderError, ProviderHttp } from './provider-http';

export type ConnectorResult = {
  status: 'SUCCEEDED' | 'AWAITING_ACCOUNT' | 'AWAITING_MANUAL';
  detail: string;
  remoteId?: string;
};
type Resource = Pick<
  AccessResource,
  'name' | 'remoteId' | 'containerId' | 'resourceType' | 'sensitive'
>;
interface GithubUser {
  id: number;
  login: string;
}
interface DrivePermission {
  id: string;
  type: string;
  emailAddress?: string;
  role: string;
  permissionDetails?: { inherited?: boolean }[];
}

@Injectable()
export class ConnectorsService {
  constructor(private readonly http: ProviderHttp) {}

  async inventory(operation: AccessOperation) {
    const observation = await this.execute({ ...operation, action: 'VERIFY' });
    const resource = operation.resourceSnapshot as unknown as Resource;
    const discovered: {
      remoteId: string;
      name: string;
      administrative: boolean;
    }[] = [];
    if (
      operation.provider === 'DISCORD' &&
      operation.providerUserId &&
      operation.verificationNote &&
      resource.containerId
    ) {
      const token = process.env.ACCESS_DISCORD_BOT_TOKEN;
      if (!token) throw new ProviderError('DISCORD_NOT_CONFIGURED');
      const base = `https://discord.com/api/v10/guilds/${encodeURIComponent(resource.containerId)}`;
      const auth = `Bot ${token}`;
      const member = await this.http.request<{
        roles: string[];
        user: { bot?: boolean };
      }>(
        `${base}/members/${encodeURIComponent(operation.providerUserId)}`,
        auth,
        'GET',
        undefined,
        true,
      );
      if (member?.user.bot) throw new ProviderError('DISCORD_BOT_EXCLUDED');
      const roles = await this.http.request<
        { id: string; name: string; permissions: string }[]
      >(`${base}/roles`, auth);
      for (const role of roles || []) {
        if (member?.roles.includes(role.id))
          discovered.push({
            remoteId: role.id,
            name: role.name,
            administrative:
              (BigInt(role.permissions) & ((1n << 28n) | 8n)) !== 0n,
          });
      }
    }
    return { observation, discovered, partial: true };
  }

  async execute(operation: AccessOperation): Promise<ConnectorResult> {
    const resource = operation.resourceSnapshot as unknown as Resource;
    if (
      !operation.providerUserId?.trim() ||
      !operation.verificationNote ||
      operation.verificationNote.trim().length < 5
    )
      return {
        status: 'AWAITING_ACCOUNT',
        detail: 'Confirmar conta externa antes de executar',
      };
    if (operation.provider === 'DISCORD')
      return this.discord(operation, resource);
    if (operation.provider === 'GITHUB')
      return this.github(operation, resource);
    if (operation.provider === 'GOOGLE_DRIVE')
      return this.drive(operation, resource);
    return { status: 'AWAITING_MANUAL', detail: 'Serviço de gestão manual' };
  }

  private async discord(
    op: AccessOperation,
    resource: Resource,
  ): Promise<ConnectorResult> {
    const token = process.env.ACCESS_DISCORD_BOT_TOKEN;
    const guild = resource.containerId;
    if (!token || !guild) throw new ProviderError('DISCORD_NOT_CONFIGURED');
    if (
      ![guild, resource.remoteId, op.providerUserId!].every((value) =>
        /^\d{15,22}$/.test(value),
      )
    )
      throw new ProviderError('DISCORD_INVALID_ID');
    const auth = `Bot ${token}`;
    const base = `https://discord.com/api/v10/guilds/${guild}`;
    const accessibleGuild = await this.http.request<{ id: string }>(base, auth);
    if (accessibleGuild?.id !== guild)
      throw new ProviderError('DISCORD_GUILD_UNVERIFIED');
    type Member = { roles: string[]; user: { id: string; bot?: boolean } };
    const member = await this.http.request<Member>(
      `${base}/members/${op.providerUserId}`,
      auth,
      'GET',
      undefined,
      true,
    );
    if (!member)
      return {
        status: op.action === 'REVOKE' ? 'SUCCEEDED' : 'AWAITING_ACCOUNT',
        detail: 'Conta ainda fora do servidor',
      };
    if (member.user.bot) throw new ProviderError('DISCORD_BOT_EXCLUDED');
    const roles = await this.http.request<
      { id: string; position: number; managed: boolean; permissions: string }[]
    >(`${base}/roles`, auth);
    const role = roles?.find((value) => value.id === resource.remoteId);
    const bot = await this.http.request<{ id: string }>(
      'https://discord.com/api/v10/users/@me',
      auth,
    );
    const self = await this.http.request<Member>(
      `${base}/members/${bot?.id}`,
      auth,
    );
    if (!role || role.managed || role.id === guild)
      throw new ProviderError('DISCORD_PROTECTED_ROLE');
    const botRoles =
      roles?.filter((value) => self?.roles.includes(value.id)) || [];
    if (
      !botRoles.some(
        (value) =>
          (BigInt(value.permissions) & (1n << 28n)) !== 0n ||
          (BigInt(value.permissions) & 8n) !== 0n,
      ) ||
      Math.max(...botRoles.map((value) => value.position)) <= role.position
    )
      throw new ProviderError('DISCORD_ROLE_HIERARCHY');
    // Administrative roles are intentionally handed to a human, including server-manager.
    if ((BigInt(role.permissions) & ((1n << 28n) | 8n)) !== 0n)
      return {
        status: 'AWAITING_MANUAL',
        detail: 'Cargo administrativo requer intervenção manual',
      };
    const present = member.roles.includes(resource.remoteId);
    if (op.action === 'VERIFY')
      return {
        status: present ? 'SUCCEEDED' : 'AWAITING_MANUAL',
        detail: present ? 'Cargo confirmado' : 'Cargo ausente',
      };
    if (present !== (op.action === 'GRANT'))
      await this.http.request(
        `${base}/members/${op.providerUserId}/roles/${resource.remoteId}`,
        auth,
        op.action === 'GRANT' ? 'PUT' : 'DELETE',
      );
    const after = await this.http.request<Member>(
      `${base}/members/${op.providerUserId}`,
      auth,
      'GET',
      undefined,
      true,
    );
    if (
      (after?.roles.includes(resource.remoteId) || false) !==
      (op.action === 'GRANT')
    )
      throw new ProviderError('DISCORD_VERIFICATION_FAILED', true);
    return { status: 'SUCCEEDED', detail: 'Estado do cargo verificado por ID' };
  }

  private async githubPages<T>(path: string, token: string): Promise<T[]> {
    const values: T[] = [];
    for (let page = 1; page <= 100; page++) {
      const batch =
        (await this.http.request<T[]>(
          `https://api.github.com${path}${path.includes('?') ? '&' : '?'}per_page=100&page=${page}`,
          token,
        )) || [];
      values.push(...batch);
      if (batch.length < 100) return values;
    }
    throw new ProviderError('GITHUB_PAGINATION_LIMIT');
  }

  private async github(
    op: AccessOperation,
    resource: Resource,
  ): Promise<ConnectorResult> {
    if (!/^\d+$/.test(op.providerUserId!))
      throw new ProviderError('GITHUB_REQUIRES_NUMERIC_ACCOUNT_ID');
    const token = await this.http.github();
    const user = await this.http.request<GithubUser>(
      `https://api.github.com/user/${op.providerUserId}`,
      token,
    );
    if (!user || String(user.id) !== op.providerUserId)
      throw new ProviderError('GITHUB_ACCOUNT_MISMATCH');
    const org =
      resource.resourceType === 'GITHUB_ORG'
        ? resource.remoteId
        : resource.containerId;
    if (!org || !/^[a-zA-Z0-9-]+$/.test(org))
      throw new ProviderError('GITHUB_INVALID_ORG');
    const base = `https://api.github.com/orgs/${org}`;
    const team = resource.resourceType === 'GITHUB_TEAM';
    if (team)
      await this.http.request(
        `${base}/teams/${encodeURIComponent(resource.remoteId)}`,
        token,
      );
    const path = team
      ? `${base}/teams/${encodeURIComponent(resource.remoteId)}/memberships/${encodeURIComponent(user.login)}`
      : `${base}/memberships/${encodeURIComponent(user.login)}`;
    type Membership = { state: string; role: string };
    const before = await this.http.request<Membership>(
      path,
      token,
      'GET',
      undefined,
      true,
    );
    if (before?.role === 'admin' || before?.role === 'maintainer')
      return {
        status: 'AWAITING_MANUAL',
        detail: 'Proprietário/maintainer exige revisão manual',
      };
    if (op.action === 'VERIFY')
      return {
        status: before?.state === 'active' ? 'SUCCEEDED' : 'AWAITING_ACCOUNT',
        detail: 'Estado de pertença consultado',
      };
    if (op.action === 'GRANT') {
      if (before?.state === 'active')
        return { status: 'SUCCEEDED', detail: 'Pertença ativa confirmada' };
      if (!before) {
        if (team)
          await this.http.request(path, token, 'PUT', { role: 'member' });
        else {
          const invites = await this.githubPages<{
            id: number;
            login?: string | null;
          }>(`/orgs/${org}/invitations`, token);
          if (
            !invites.some(
              (invite) =>
                invite.login?.toLowerCase() === user.login.toLowerCase(),
            )
          )
            await this.http.request(`${base}/invitations`, token, 'POST', {
              invitee_id: user.id,
              role: 'direct_member',
            });
        }
      }
      const after = await this.http.request<Membership>(
        path,
        token,
        'GET',
        undefined,
        true,
      );
      return {
        status: after?.state === 'active' ? 'SUCCEEDED' : 'AWAITING_ACCOUNT',
        detail: 'Convite enviado; aguarda aceitação da conta verificada',
      };
    }
    if (team) {
      if (before) await this.http.request(path, token, 'DELETE');
    } else {
      const invites = await this.githubPages<{
        id: number;
        login?: string | null;
        email?: string;
      }>(`/orgs/${org}/invitations`, token);
      const ambiguous = invites.some(
        (invite) =>
          !invite.login &&
          Boolean(op.accountEmail) &&
          invite.email?.toLowerCase() === op.accountEmail?.toLowerCase(),
      );
      if (ambiguous)
        return {
          status: 'AWAITING_MANUAL',
          detail:
            'Convite apenas por email requer confirmação manual de identidade',
        };
      for (const invite of invites.filter(
        (value) => value.login?.toLowerCase() === user.login.toLowerCase(),
      ))
        await this.http.request(
          `${base}/invitations/${invite.id}`,
          token,
          'DELETE',
        );
      const remainingInvites = await this.githubPages<{
        id: number;
        login?: string | null;
      }>(`/orgs/${org}/invitations`, token);
      if (
        remainingInvites.some(
          (invite) => invite.login?.toLowerCase() === user.login.toLowerCase(),
        )
      )
        throw new ProviderError(
          'GITHUB_INVITATION_REVOCATION_UNVERIFIED',
          true,
        );
      if (before)
        await this.http.request(
          `${base}/members/${encodeURIComponent(user.login)}`,
          token,
          'DELETE',
        );
      // Org removal alone is insufficient if direct repository collaboration still exists.
      const repositories = await this.githubPages<{ name: string }>(
        `/orgs/${org}/repos`,
        token,
      );
      for (const repo of repositories) {
        const direct = await this.githubPages<GithubUser>(
          `/repos/${org}/${encodeURIComponent(repo.name)}/collaborators?affiliation=direct`,
          token,
        );
        if (direct.some((value) => value.id === user.id))
          return {
            status: 'AWAITING_MANUAL',
            detail:
              'Acesso direto a repositório encontrado; rever e remover manualmente',
          };
      }
    }
    const after = await this.http.request<Membership>(
      path,
      token,
      'GET',
      undefined,
      true,
    );
    if (after) throw new ProviderError('GITHUB_REVOCATION_UNVERIFIED', true);
    return {
      status: 'SUCCEEDED',
      detail: 'Pertença e convites associados ao ID remoto revogados',
    };
  }

  private async drivePermissions(
    file: string,
    token: string,
  ): Promise<DrivePermission[]> {
    const permissions: DrivePermission[] = [];
    let page = '';
    for (let i = 0; i < 100; i++) {
      const result = await this.http.request<{
        permissions?: DrivePermission[];
        nextPageToken?: string;
      }>(
        `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(file)}/permissions?supportsAllDrives=true&pageSize=100&fields=nextPageToken,permissions(id,type,emailAddress,role,permissionDetails)&pageToken=${encodeURIComponent(page)}`,
        token,
      );
      permissions.push(...(result?.permissions || []));
      if (!result?.nextPageToken) return permissions;
      page = result.nextPageToken;
    }
    throw new ProviderError('DRIVE_PAGINATION_LIMIT');
  }

  private async drive(
    op: AccessOperation,
    resource: Resource,
  ): Promise<ConnectorResult> {
    if (op.action === 'REVOKE' && !/^\d+$/.test(op.providerUserId || ''))
      throw new ProviderError('DRIVE_REQUIRES_PERMISSION_ID');
    if (!/^[\w-]+$/.test(resource.remoteId))
      throw new ProviderError('DRIVE_INVALID_FOLDER');
    const token = await this.http.google('drive');
    const root = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(resource.remoteId)}`;
    const meta = await this.http.request<{
      mimeType: string;
      inheritedPermissionsDisabled?: boolean;
    }>(
      `${root}?supportsAllDrives=true&fields=mimeType,inheritedPermissionsDisabled`,
      token,
    );
    if (meta?.mimeType !== 'application/vnd.google-apps.folder')
      throw new ProviderError('DRIVE_NOT_A_FOLDER');
    if (resource.sensitive && !meta.inheritedPermissionsDisabled)
      return {
        status: 'AWAITING_MANUAL',
        detail: 'Auditar acesso limitado/herança antes de gerir pasta sensível',
      };
    const permissions = await this.drivePermissions(resource.remoteId, token);
    const match = permissions.find(
      (value) => value.id === op.providerUserId && value.type === 'user',
    );
    if (
      op.action === 'REVOKE' &&
      !match &&
      op.accountEmail &&
      permissions.some(
        (permission) =>
          permission.emailAddress?.toLowerCase() ===
          op.accountEmail!.toLowerCase(),
      )
    )
      throw new ProviderError('DRIVE_ACCOUNT_MISMATCH');
    if (
      match &&
      op.accountEmail &&
      match.emailAddress?.toLowerCase() !== op.accountEmail.toLowerCase()
    )
      throw new ProviderError('DRIVE_ACCOUNT_MISMATCH');
    if (op.action === 'VERIFY')
      return {
        status: match ? 'SUCCEEDED' : 'AWAITING_MANUAL',
        detail: 'Permissão direta consultada; inventário parcial',
      };
    if (op.action === 'GRANT') {
      if (match)
        return {
          status: 'SUCCEEDED',
          detail: 'Permissão de utilizador confirmada',
          remoteId: match.id,
        };
      if (!op.accountEmail) throw new ProviderError('DRIVE_EMAIL_REQUIRED');
      const emailMatches = permissions.filter(
        (value) =>
          value.emailAddress?.toLowerCase() === op.accountEmail!.toLowerCase(),
      );
      if (emailMatches.length === 1 && emailMatches[0].type === 'user')
        return {
          status: 'SUCCEEDED',
          detail:
            'Permissão existente confirmada para o principal Google aprovado',
          remoteId: emailMatches[0].id,
        };
      if (emailMatches.length)
        throw new ProviderError('DRIVE_ACCOUNT_MISMATCH');
      const created = await this.http.request<DrivePermission>(
        `${root}/permissions?supportsAllDrives=true&sendNotificationEmail=true&fields=id,type,emailAddress,role`,
        token,
        'POST',
        { type: 'user', role: 'writer', emailAddress: op.accountEmail },
      );
      if (!created?.id) throw new ProviderError('DRIVE_GRANT_UNVERIFIED', true);
      const after = await this.drivePermissions(resource.remoteId, token);
      if (
        !after.some(
          (value) =>
            value.id === created.id &&
            value.emailAddress?.toLowerCase() ===
              op.accountEmail!.toLowerCase(),
        )
      )
        throw new ProviderError('DRIVE_GRANT_UNVERIFIED', true);
      return {
        status: 'SUCCEEDED',
        detail: 'Permissão criada e verificada',
        remoteId: created.id,
      };
    }
    // Traverse descendants, including ordinary files, so direct child grants cannot survive unnoticed.
    const pending = [resource.remoteId];
    const seen = new Set<string>();
    let inherited = false;
    while (pending.length) {
      const file = pending.shift()!;
      if (seen.has(file)) continue;
      seen.add(file);
      if (seen.size > 5000) throw new ProviderError('DRIVE_SCAN_LIMIT');
      const current =
        file === resource.remoteId
          ? permissions
          : await this.drivePermissions(file, token);
      const permission = current.find(
        (value) => value.id === op.providerUserId && value.type === 'user',
      );
      if (
        current.some(
          (value) =>
            value.type === 'group' ||
            value.type === 'domain' ||
            value.type === 'anyone',
        )
      )
        inherited = true;
      if (permission) {
        if (permission.role === 'owner' || permission.role === 'organizer')
          return {
            status: 'AWAITING_MANUAL',
            detail: 'Propriedade/organizer requer transferência manual',
          };
        if (permission.permissionDetails?.some((value) => value.inherited))
          inherited = true;
        else {
          await this.http.request(
            `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(file)}/permissions/${encodeURIComponent(permission.id)}?supportsAllDrives=true`,
            token,
            'DELETE',
          );
          if (
            (await this.drivePermissions(file, token)).some(
              (value) => value.id === permission.id,
            )
          )
            throw new ProviderError('DRIVE_REVOCATION_UNVERIFIED', true);
        }
      }
      let page = '';
      for (let i = 0; i < 100; i++) {
        const query = new URLSearchParams({
          q: `'${file}' in parents and trashed=false`,
          fields: 'nextPageToken,files(id,mimeType)',
          pageSize: '1000',
          supportsAllDrives: 'true',
          includeItemsFromAllDrives: 'true',
          pageToken: page,
        });
        const children = await this.http.request<{
          files?: { id: string; mimeType: string }[];
          nextPageToken?: string;
        }>(`https://www.googleapis.com/drive/v3/files?${query}`, token);
        for (const child of children?.files || []) {
          if (child.mimeType === 'application/vnd.google-apps.folder')
            pending.push(child.id);
          else {
            const childPermissions = await this.drivePermissions(
              child.id,
              token,
            );
            const direct = childPermissions.find(
              (value) =>
                value.id === op.providerUserId &&
                !value.permissionDetails?.some((detail) => detail.inherited),
            );
            if (direct) {
              if (direct.role === 'owner' || direct.role === 'organizer')
                return {
                  status: 'AWAITING_MANUAL',
                  detail:
                    'Transferir responsabilidade de ficheiros antes de concluir',
                };
              await this.http.request(
                `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(child.id)}/permissions/${encodeURIComponent(direct.id)}?supportsAllDrives=true`,
                token,
                'DELETE',
              );
              if (
                (await this.drivePermissions(child.id, token)).some(
                  (value) => value.id === direct.id,
                )
              )
                throw new ProviderError('DRIVE_REVOCATION_UNVERIFIED', true);
            }
            if (
              childPermissions.some((value) =>
                ['group', 'domain', 'anyone'].includes(value.type),
              )
            )
              inherited = true;
          }
        }
        if (!children?.nextPageToken) break;
        if (i === 99) throw new ProviderError('DRIVE_PAGINATION_LIMIT');
        page = children.nextPageToken;
      }
    }
    return {
      status: inherited ? 'AWAITING_MANUAL' : 'SUCCEEDED',
      detail: inherited
        ? 'Grants diretos tratados; confirmar acessos por grupos, domínio, links ou herança'
        : 'Permissões diretas revogadas na pasta e descendentes; inventário parcial',
    };
  }

  asJson(result: ConnectorResult): Prisma.InputJsonValue {
    return { ...result };
  }
}
