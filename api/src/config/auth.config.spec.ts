import { authSecrets, passwordRecoveryOrigin } from './auth.config';

describe('auth secrets', () => {
  it('fails closed on missing, short or reused production credentials', () => {
    const production = { NODE_ENV: 'production' };
    const key = 'a'.repeat(32);

    expect(() => authSecrets(production)).toThrow();
    expect(() =>
      authSecrets({
        ...production,
        JWT_SECRET: key,
        REFRESH_TOKEN_SECRET: 'x',
      }),
    ).toThrow();
    expect(() =>
      authSecrets({
        ...production,
        JWT_SECRET: key,
        REFRESH_TOKEN_SECRET: key,
      }),
    ).toThrow();
    expect(
      authSecrets({
        ...production,
        JWT_SECRET: key,
        REFRESH_TOKEN_SECRET: 'b'.repeat(32),
      }),
    ).toEqual({ signing: key, fingerprint: 'b'.repeat(32) });
  });
});

describe('password recovery URL', () => {
  it.each([
    undefined,
    'invalid',
    'http://example.test',
    'https://user@example.test',
  ])('rejects an invalid production APP_URL (%s)', (APP_URL) => {
    expect(() =>
      passwordRecoveryOrigin({ NODE_ENV: 'production', APP_URL }),
    ).toThrow('Production requires an HTTPS APP_URL without credentials.');
  });

  it('accepts the HTTPS deployment URL and keeps the development default', () => {
    expect(
      passwordRecoveryOrigin({
        NODE_ENV: 'production',
        APP_URL: 'https://example.test',
      }).origin,
    ).toBe('https://example.test');
    expect(passwordRecoveryOrigin({}).origin).toBe('http://localhost:3090');
  });
});
