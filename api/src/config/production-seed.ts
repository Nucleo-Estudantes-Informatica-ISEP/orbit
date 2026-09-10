export type ProductionAdminSeedConfig = {
  email: string;
  password: string;
  name: string;
};

export function getProductionAdminSeedConfig(
  env: Record<string, string | undefined>,
): ProductionAdminSeedConfig {
  const email = env.ADMIN_EMAIL?.trim().toLowerCase();
  if (!email || !email.includes('@')) {
    throw new Error('ADMIN_EMAIL must be explicitly configured for the production seed.');
  }

  const password = env.ADMIN_PASSWORD;
  if (!password) {
    throw new Error('ADMIN_PASSWORD must be explicitly configured for the production seed.');
  }
  if (password.length < 16) {
    throw new Error('ADMIN_PASSWORD must contain at least 16 characters.');
  }

  return {
    email,
    password,
    name: env.ADMIN_NAME?.trim() || 'Administrator',
  };
}
