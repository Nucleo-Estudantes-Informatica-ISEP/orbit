import { authSecrets } from './auth.config';

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
