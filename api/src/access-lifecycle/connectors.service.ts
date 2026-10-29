import { Injectable } from '@nestjs/common';
import type { AccessOperation, AccessResource, Prisma } from '@prisma/client';
import { ProviderError, ProviderHttp } from './provider-http';

const privilegedDiscordPermissions = 8n | (1n << 5n) | (1n << 28n);
type DiscordRole = { id: string; managed?: boolean; permissions: string };

export type ConnectorResult = {
  status: 'SUCCEEDED' | 'AWAITING_ACCOUNT' | 'AWAITING_MANUAL';
  detail: string;
  remoteId?: string;
  accountName?: string;
  identitySource?: 'SHEETS' | 'OPERATOR';
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

  private assertDiscordRole(
    resource: { remoteId: string; sensitive: boolean },
    role: DiscordRole | undefined,
    guild: string,
  ) {
    if (
      !role ||
      role.managed ||
      role.id === guild ||
      ((BigInt(role.permissions) & privilegedDiscordPermissions) !== 0n &&
        !resource.sensitive)
    )
      throw new ProviderError('DISCORD_PROTECTED_ROLE');
  }

  async validateDiscordResource(resource: {
    provider: string;
    enabled: boolean;
    automatic: boolean;
    remoteId: string;
    containerId?: string | null;
    sensitive: boolean;
  }) {
    if (
      resource.provider !== 'DISCORD' ||
      !resource.enabled ||
      !resource.automatic ||
      resource.remoteId === 'CONFIGURE_ME'
    )
      return;
    const token = process.env.ACCESS_DISCORD_BOT_TOKEN;
    if (!token || !resource.containerId)
      throw new ProviderError('DISCORD_NOT_CONFIGURED');
    if (
      ![resource.remoteId, resource.containerId].every((value) =>
        /^\d{15,22}$/.test(value),
      )
    )
      throw new ProviderError('DISCORD_INVALID_ID');
    const roles = await this.http.request<DiscordRole[]>(
      `https://discord.com/api/v10/guilds/${resource.containerId}/roles`,
      `Bot ${token}`,
    );
    this.assertDiscordRole(
      resource,
      roles?.find((role) => role.id === resource.remoteId),
      resource.containerId,
    );
  }

  async resolveIdentity<
    T extends Pick<
      AccessOperation,
      | 'provider'
      | 'providerUserId'
      | 'accountEmail'
      | 'verificationNote'
      | 'resourceSnapshot'
    >,
  >(operation: T): Promise<T> {
    const explicitUsername = operation.providerUserId?.trim().startsWith('@');
    const principal = operation.providerUserId?.trim().replace(/^@/, '');
    if (!principal) return operation;
    if (
      operation.provider === 'DISCORD' &&
      (explicitUsername || !/^\d{15,22}$/.test(principal))
    ) {
      const resource = operation.resourceSnapshot as unknown as Resource;
      const token = process.env.ACCESS_DISCORD_BOT_TOKEN;
      if (!token || !resource.containerId)
        throw new ProviderError('DISCORD_NOT_CONFIGURED');
      if (!/^[a-zA-Z0-9_.]{2,32}(#\d{4})?$/.test(principal))
        throw new ProviderError('DISCORD_INVALID_USERNAME');
      const [username, discriminator] = principal.split('#');
      const members = await this.http.request<
        {
          user: {
            id: string;
            username: string;
            discriminator?: string;
            bot?: boolean;
          };
        }[]
      >(
        `https://discord.com/api/v10/guilds/${encodeURIComponent(resource.containerId)}/members/search?query=${encodeURIComponent(username)}&limit=1000`,
        `Bot ${token}`,
      );
      const matches = (members || []).filter(
        (member) =>
          member.user.username.toLowerCase() === username.toLowerCase() &&
          (!discriminator || member.user.discriminator === discriminator),
      );
      if (matches.length > 1)
        throw new ProviderError('DISCORD_AMBIGUOUS_USERNAME');
      if (matches[0]?.user.bot) throw new ProviderError('DISCORD_BOT_EXCLUDED');
      return {
        ...operation,
        providerUserId:
          matches[0]?.user.id ||
          (explicitUsername ? `@${principal}` : principal),
      };
    }
    if (
      operation.provider === 'GITHUB' &&
      (explicitUsername || !/^\d+$/.test(principal))
    ) {
      if (!/^[a-z\d](?:[a-z\d-]{0,37}[a-z\d])?$/i.test(principal))
        throw new ProviderError('GITHUB_INVALID_USERNAME');
      const user = await this.http.request<GithubUser>(
        `https://api.github.com/users/${encodeURIComponent(principal)}`,
        await this.http.github(),
        'GET',
        undefined,
        true,
      );
      if (user && user.login.toLowerCase() !== principal.toLowerCase())
        throw new ProviderError('GITHUB_ACCOUNT_MISMATCH');
      return {
        ...operation,
        providerUserId: user
          ? String(user.id)
          : explicitUsername
            ? `@${principal}`
            : principal,
      };
    }
    return { ...operation, providerUserId: principal };
  }

  async inventory(operation: AccessOperation) {
    operation = await this.resolveIdentity(operation);
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
      /^\d+$/.test(operation.providerUserId) &&
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
              (BigInt(role.permissions) & privilegedDiscordPermissions) !== 0n,
          });
      }
    }
    return { observation, discovered, partial: true };
  }

  async execute(operation: AccessOperation): Promise<ConnectorResult> {
    const resource = operation.resourceSnapshot as unknown as Resource;
    if (resource.remoteId === 'CONFIGURE_ME')
      return {
        status: 'AWAITING_MANUAL',
        detail:
          'Configurar o recurso na administração; executar e confirmar o passo manualmente ou criar novo pedido após configuração.',
      };
    if (!operation.providerUserId?.trim())
      return {
        status: 'AWAITING_ACCOUNT',
        detail: 'Indicar username ou email da conta no pedido',
      };
    const accountName = operation.providerUserId;
    operation = await this.resolveIdentity(operation);
    if (
      ['DISCORD', 'GITHUB'].includes(operation.provider) &&
      !/^\d+$/.test(operation.providerUserId || '')
    )
      return {
        status: 'AWAITING_ACCOUNT',
        detail:
          'Conta não encontrada. Discord: entrar primeiro no servidor com o username indicado; depois repetir a verificação.',
        accountName: accountName || undefined,
      };
    if (operation.provider === 'DISCORD')
      return {
        ...(await this.discord(operation, resource)),
        remoteId: operation.providerUserId!,
        accountName: accountName || undefined,
      };
    if (operation.provider === 'GITHUB')
      return {
        ...(await this.github(operation, resource)),
        remoteId: operation.providerUserId!,
        accountName: accountName || undefined,
      };
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
    this.assertDiscordRole(resource, role, guild);
    const bot = await this.http.request<{ id: string }>(
      'https://discord.com/api/v10/users/@me',
      auth,
    );
    const self = await this.http.request<Member>(
      `${base}/members/${bot?.id}`,
      auth,
    );
    const botRoles =
      roles?.filter((value) => self?.roles.includes(value.id)) || [];
    if (
      !botRoles.some(
        (value) =>
          (BigInt(value.permissions) & (1n << 28n)) !== 0n ||
          (BigInt(value.permissions) & 8n) !== 0n,
      ) ||
      Math.max(...botRoles.map((value) => value.position)) <= role!.position
    )
      throw new ProviderError('DISCORD_ROLE_HIERARCHY');
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

  private driveCanWrite(permission: DrivePermission): boolean {
    return (
      permission.type === 'user' &&
      ['writer', 'fileOrganizer', 'organizer', 'owner'].includes(
        permission.role,
      )
    );
  }

  private async driveExistingGrant(
    permission: DrivePermission,
    file: string,
    token: string,
  ): Promise<ConnectorResult> {
    if (
      permission.type === 'user' &&
      ['reader', 'commenter'].includes(permission.role)
    ) {
      let id = permission.id;
      if (permission.permissionDetails?.some((value) => value.inherited)) {
        if (!permission.emailAddress)
          return {
            status: 'AWAITING_MANUAL',
            detail:
              'Google não disponibilizou o email da permissão herdada; confirmar a conta com o responsável.',
            remoteId: id,
          };
        const direct = await this.http.request<DrivePermission>(
          `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(file)}/permissions?supportsAllDrives=true&sendNotificationEmail=true&fields=id`,
          token,
          'POST',
          {
            type: 'user',
            role: 'writer',
            emailAddress: permission.emailAddress,
          },
        );
        if (!direct?.id)
          throw new ProviderError('DRIVE_GRANT_UNVERIFIED', true);
        id = direct.id;
      } else
        await this.http.request(
          `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(file)}/permissions/${encodeURIComponent(permission.id)}?supportsAllDrives=true`,
          token,
          'PATCH',
          { role: 'writer' },
        );
      const after = (await this.drivePermissions(file, token)).find(
        (value) =>
          value.id === id &&
          value.emailAddress?.toLowerCase() ===
            permission.emailAddress?.toLowerCase(),
      );
      if (!after || !this.driveCanWrite(after))
        throw new ProviderError('DRIVE_GRANT_UNVERIFIED', true);
      return {
        status: 'SUCCEEDED',
        detail: 'Escrita concedida e confirmada pela API Google',
        remoteId: id,
      };
    }
    return {
      status: this.driveCanWrite(permission) ? 'SUCCEEDED' : 'AWAITING_MANUAL',
      detail: this.driveCanWrite(permission)
        ? 'Permissão de escrita confirmada para o utilizador aprovado'
        : 'Permissão existente sem escrita; conceder escrita e confirmar manualmente',
      remoteId: permission.id,
    };
  }

  private async drive(
    op: AccessOperation,
    resource: Resource,
  ): Promise<ConnectorResult> {
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
    const permissions = await this.drivePermissions(resource.remoteId, token);
    if (
      resource.sensitive &&
      op.action === 'GRANT' &&
      permissions.some(
        (permission) =>
          ['group', 'domain', 'anyone'].includes(permission.type) ||
          permission.permissionDetails?.some((detail) => detail.inherited),
      )
    )
      return {
        status: 'AWAITING_MANUAL',
        detail:
          'Pasta sensível com acesso indireto por herança, grupo, domínio ou link; o responsável deve auditar essa origem antes de conceder acesso. Nenhuma alteração executada.',
      };
    const emailPrincipal = op.providerUserId?.includes('@')
      ? op.providerUserId.trim().toLowerCase()
      : undefined;
    const accountEmail =
      op.accountEmail?.trim().toLowerCase() || emailPrincipal;
    if (emailPrincipal && accountEmail !== emailPrincipal)
      throw new ProviderError('DRIVE_ACCOUNT_MISMATCH');
    if (emailPrincipal && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(emailPrincipal))
      throw new ProviderError('DRIVE_EMAIL_REQUIRED');
    const emailMatches = emailPrincipal
      ? permissions.filter(
          (value) =>
            value.type === 'user' &&
            value.emailAddress?.toLowerCase() === emailPrincipal,
        )
      : [];
    if (emailMatches.length > 1)
      throw new ProviderError('DRIVE_ACCOUNT_MISMATCH');
    const match = emailPrincipal
      ? emailMatches[0]
      : permissions.find(
          (value) => value.id === op.providerUserId && value.type === 'user',
        );
    if (
      !emailPrincipal &&
      op.action === 'REVOKE' &&
      !match &&
      op.accountEmail &&
      permissions.some(
        (permission) => permission.emailAddress?.toLowerCase() === accountEmail,
      )
    )
      throw new ProviderError('DRIVE_ACCOUNT_MISMATCH');
    if (
      match &&
      op.accountEmail &&
      match.emailAddress?.toLowerCase() !== accountEmail
    )
      throw new ProviderError('DRIVE_ACCOUNT_MISMATCH');
    if (op.action === 'VERIFY')
      return {
        status: match ? 'SUCCEEDED' : 'AWAITING_MANUAL',
        detail: 'Permissão direta consultada; inventário parcial',
      };
    if (op.action === 'GRANT') {
      if (match)
        return this.driveExistingGrant(match, resource.remoteId, token);
      if (!accountEmail) throw new ProviderError('DRIVE_EMAIL_REQUIRED');
      // Without a matching permission ID, the approved principal must be the
      // same email we send to Google. Never substitute an unrelated email for it.
      if (op.providerUserId?.trim().toLowerCase() !== accountEmail)
        throw new ProviderError('DRIVE_ACCOUNT_MISMATCH');
      const emailMatches = permissions.filter(
        (value) => value.emailAddress?.toLowerCase() === accountEmail,
      );
      if (emailMatches.length === 1 && emailMatches[0].type === 'user')
        return this.driveExistingGrant(
          emailMatches[0],
          resource.remoteId,
          token,
        );
      if (emailMatches.length)
        throw new ProviderError('DRIVE_ACCOUNT_MISMATCH');
      const created = await this.http.request<DrivePermission>(
        `${root}/permissions?supportsAllDrives=true&sendNotificationEmail=true&fields=id,type,emailAddress,role`,
        token,
        'POST',
        { type: 'user', role: 'writer', emailAddress: accountEmail },
      );
      if (!created?.id) throw new ProviderError('DRIVE_GRANT_UNVERIFIED', true);
      const after = await this.drivePermissions(resource.remoteId, token);
      if (
        !after.some(
          (value) =>
            value.id === created.id &&
            value.emailAddress?.toLowerCase() === accountEmail &&
            this.driveCanWrite(value),
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
        (value) =>
          value.type === 'user' &&
          (emailPrincipal
            ? value.emailAddress?.toLowerCase() === emailPrincipal
            : value.id === op.providerUserId),
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
                value.type === 'user' &&
                (emailPrincipal
                  ? value.emailAddress?.toLowerCase() === emailPrincipal
                  : value.id === op.providerUserId) &&
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
