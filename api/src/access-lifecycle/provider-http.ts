import { Injectable } from '@nestjs/common';
import { createSign } from 'node:crypto';

export class ProviderError extends Error {
  constructor(
    public readonly code: string,
    public readonly retryable = false,
  ) {
    super(code);
  }
}

@Injectable()
export class ProviderHttp {
  private googleCache = new Map<string, { token: string; until: number }>();
  private githubCache?: { token: string; until: number };

  async request<T>(
    url: string,
    token: string,
    method = 'GET',
    body?: unknown,
    optional404 = false,
  ): Promise<T | undefined> {
    let response: Response;
    try {
      response = await fetch(url, {
        method,
        redirect: 'error',
        signal: AbortSignal.timeout(15000),
        headers: {
          Authorization: token,
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'User-Agent': 'Orbit-Access-Lifecycle',
          ...(url.startsWith('https://api.github.com/')
            ? { 'X-GitHub-Api-Version': '2022-11-28' }
            : {}),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
    } catch {
      throw new ProviderError('PROVIDER_UNAVAILABLE', true);
    }
    if (optional404 && response.status === 404) return undefined;
    if (!response.ok)
      throw new ProviderError(
        `PROVIDER_HTTP_${response.status}`,
        response.status === 429 || response.status >= 500,
      );
    if (
      response.status === 204 ||
      response.headers.get('content-length') === '0'
    )
      return undefined;
    const text = await response.text();
    if (!text) return undefined;
    try {
      return JSON.parse(text) as T;
    } catch {
      throw new ProviderError('PROVIDER_INVALID_RESPONSE');
    }
  }

  signedJwt(payload: object, key: string) {
    const unsigned = `${Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url')}.${Buffer.from(JSON.stringify(payload)).toString('base64url')}`;
    return `${unsigned}.${createSign('RSA-SHA256').update(unsigned).sign(key.replace(/\\n/g, '\n'), 'base64url')}`;
  }

  async google(scope: 'sheets' | 'drive' | 'forms') {
    const cached = this.googleCache.get(scope);
    if (cached && cached.until > Date.now()) return `Bearer ${cached.token}`;
    const email = process.env.ACCESS_GOOGLE_CLIENT_EMAIL;
    const key = process.env.ACCESS_GOOGLE_PRIVATE_KEY;
    if (!email || !key) throw new ProviderError('GOOGLE_NOT_CONFIGURED');
    const now = Math.floor(Date.now() / 1000);
    const assertion = this.signedJwt(
      {
        iss: email,
        scope:
          scope === 'sheets'
            ? 'https://www.googleapis.com/auth/spreadsheets.readonly'
            : scope === 'forms'
              ? 'https://www.googleapis.com/auth/forms.body.readonly https://www.googleapis.com/auth/forms.responses.readonly'
              : 'https://www.googleapis.com/auth/drive',
        aud: 'https://oauth2.googleapis.com/token',
        iat: now,
        exp: now + 3600,
      },
      key,
    );
    let response: Response;
    try {
      response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        signal: AbortSignal.timeout(15000),
        body: new URLSearchParams({
          grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
          assertion,
        }),
      });
    } catch {
      throw new ProviderError('GOOGLE_AUTH_UNAVAILABLE', true);
    }
    if (!response.ok) throw new ProviderError('GOOGLE_AUTH_FAILED');
    const data = (await response.json()) as {
      access_token: string;
      expires_in: number;
    };
    if (!data.access_token) throw new ProviderError('GOOGLE_AUTH_INVALID');
    this.googleCache.set(scope, {
      token: data.access_token,
      until: Date.now() + (data.expires_in - 120) * 1000,
    });
    return `Bearer ${data.access_token}`;
  }

  async github() {
    if (this.githubCache && this.githubCache.until > Date.now())
      return `Bearer ${this.githubCache.token}`;
    const appId = process.env.ACCESS_GITHUB_APP_ID;
    const installation = process.env.ACCESS_GITHUB_INSTALLATION_ID;
    const key = process.env.ACCESS_GITHUB_PRIVATE_KEY;
    if (!appId || !installation || !key || !/^\d+$/.test(installation))
      throw new ProviderError('GITHUB_NOT_CONFIGURED');
    const now = Math.floor(Date.now() / 1000);
    const jwt = this.signedJwt(
      { iat: now - 60, exp: now + 540, iss: appId },
      key,
    );
    const data = await this.request<{ token: string; expires_at: string }>(
      `https://api.github.com/app/installations/${installation}/access_tokens`,
      `Bearer ${jwt}`,
      'POST',
    );
    if (!data?.token) throw new ProviderError('GITHUB_AUTH_INVALID');
    this.githubCache = {
      token: data.token,
      until: new Date(data.expires_at).getTime() - 120000,
    };
    return `Bearer ${data.token}`;
  }
}
