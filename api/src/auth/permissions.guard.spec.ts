import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionsGuard } from './permissions.guard';

describe('PermissionsGuard', () => {
  const makeContext = (permissions: string[]) =>
    ({
      getHandler: () => undefined,
      getClass: () => undefined,
      switchToHttp: () => ({
        getRequest: () => ({ user: { permissions } }),
      }),
    }) as unknown as ExecutionContext;

  it('returns true when no permissions are required', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(undefined),
    } as unknown as Reflector;
    const guard = new PermissionsGuard(reflector);

    expect(guard.canActivate(makeContext([]))).toBe(true);
  });

  it('allows a user with one of the required permissions', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(['TASKS_READ']),
    } as unknown as Reflector;
    const guard = new PermissionsGuard(reflector);

    expect(guard.canActivate(makeContext(['TASKS_READ']))).toBe(true);
  });

  it('returns 403 semantics for an authenticated user without permission', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(['TASKS_READ']),
    } as unknown as Reflector;
    const guard = new PermissionsGuard(reflector);

    expect(() => guard.canActivate(makeContext(['TASKS_VIEW']))).toThrow(
      ForbiddenException,
    );
  });
});
