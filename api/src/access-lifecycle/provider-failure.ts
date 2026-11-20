import {
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ProviderError } from './provider-http';

const inputErrors = new Set([
  'DISCORD_INVALID_USERNAME',
  'DISCORD_AMBIGUOUS_USERNAME',
  'DISCORD_INVALID_ID',
  'DISCORD_BOT_EXCLUDED',
  'DISCORD_PROTECTED_ROLE',
  'GITHUB_INVALID_USERNAME',
  'GITHUB_ACCOUNT_MISMATCH',
  'DRIVE_ACCOUNT_MISMATCH',
]);

/** Translate only provider failures; programming errors retain their normal handling. */
export function throwProviderFailure(error: unknown): never {
  if (!(error instanceof ProviderError)) throw error;
  const code = /^[A-Z0-9_]+$/.test(error.code)
    ? error.code
    : 'PROVIDER_UNAVAILABLE';
  if (!error.retryable && inputErrors.has(code))
    throw new BadRequestException(code);
  throw new ServiceUnavailableException(code);
}
