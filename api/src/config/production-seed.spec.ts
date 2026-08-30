import { getProductionAdminSeedConfig } from './production-seed';

describe('getProductionAdminSeedConfig', () => {
  it('requires explicit production administrator credentials', () => {
    expect(() => getProductionAdminSeedConfig({})).toThrow('ADMIN_EMAIL');
    expect(() =>
      getProductionAdminSeedConfig({ ADMIN_EMAIL: 'admin@example.com' }),
    ).toThrow('ADMIN_PASSWORD');
  });

  it('rejects weak production administrator passwords', () => {
    expect(() =>
      getProductionAdminSeedConfig({
        ADMIN_EMAIL: 'admin@example.com',
        ADMIN_PASSWORD: 'admin123',
      }),
    ).toThrow('at least 16 characters');
  });

  it('normalizes the email and returns no secret-bearing display value', () => {
    expect(
      getProductionAdminSeedConfig({
        ADMIN_EMAIL: ' Admin@Example.COM ',
        ADMIN_PASSWORD: 'a-production-password-32-chars',
        ADMIN_NAME: '  Platform Admin  ',
      }),
    ).toEqual({
      email: 'admin@example.com',
      password: 'a-production-password-32-chars',
      name: 'Platform Admin',
    });
  });
});
