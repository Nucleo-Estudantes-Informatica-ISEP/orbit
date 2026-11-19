import { randomBytes } from 'node:crypto';

const developmentSigningKey = randomBytes(32).toString('hex');
const developmentFingerprintKey = randomBytes(32).toString('hex');

export const accessTokenOptions = {
  algorithm: 'HS256' as const,
  issuer: 'orbit',
  audience: 'orbit-api',
};

export function authSecrets(env = process.env) {
  const signing = env.JWT_SECRET || developmentSigningKey;
  const fingerprint = env.REFRESH_TOKEN_SECRET || developmentFingerprintKey;

  if (
    env.NODE_ENV === 'production' &&
    (!env.JWT_SECRET ||
      !env.REFRESH_TOKEN_SECRET ||
      Buffer.byteLength(signing) < 32 ||
      Buffer.byteLength(fingerprint) < 32 ||
      signing === fingerprint)
  ) {
    throw new Error(
      'Production requires distinct JWT_SECRET and REFRESH_TOKEN_SECRET values of at least 32 bytes.',
    );
  }

  return { signing, fingerprint };
}

export function browserOrigins() {
  return (
    process.env.CORS_ORIGIN?.split(',').map((origin) => origin.trim()) ??
    (process.env.NODE_ENV === 'production'
      ? []
      : [
          'http://localhost:3000',
          'http://localhost:3001',
          'http://localhost:3090',
          'http://127.0.0.1:3001',
        ])
  );
}
