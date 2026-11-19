import {
  type ExecutionContext,
  ForbiddenException,
  HttpException,
} from '@nestjs/common';
import { AuthRequestGuard } from './auth-request.guard';

function context(origin?: string): ExecutionContext {
  function login() {}
  return {
    getHandler: () => login,
    switchToHttp: () => ({
      getRequest: () => ({
        ip: '127.0.0.1',
        body: { email: 'Synthetic@Example.test' },
        get: (header: string) => (header === 'origin' ? origin : undefined),
      }),
    }),
  } as unknown as ExecutionContext;
}

describe('authentication request guard', () => {
  it('rejects an untrusted browser origin', () => {
    const guard = new AuthRequestGuard();
    expect(() =>
      guard.canActivate(context('https://untrusted.invalid')),
    ).toThrow(ForbiddenException);
  });

  it('limits repeated requests for the same account', () => {
    const guard = new AuthRequestGuard();
    for (let i = 0; i < 12; i++)
      expect(guard.canActivate(context())).toBe(true);
    expect(() => guard.canActivate(context())).toThrow(HttpException);
  });
});
