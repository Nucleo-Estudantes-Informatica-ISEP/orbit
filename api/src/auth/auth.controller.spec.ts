import type { Request, Response } from 'express';
import { AuthController } from './auth.controller';
import type { AuthService } from './auth.service';

describe('AuthController refresh cookie', () => {
  const session = {
    user: { id: 'user-1' },
    access_token: 'access-token',
    refresh_token: 'opaque-refresh-token',
  };
  const authenticate = jest.fn().mockResolvedValue(session);
  const refreshToken = jest.fn().mockResolvedValue(session);
  const logout = jest.fn().mockResolvedValue({ message: 'Sessão terminada.' });
  const authService = {
    authenticate,
    refreshToken,
    logout,
  } as unknown as AuthService;
  const controller = new AuthController(authService);

  beforeEach(() => jest.clearAllMocks());

  function response() {
    const cookie = jest.fn();
    const clearCookie = jest.fn();
    return {
      value: { cookie, clearCookie } as unknown as Response,
      cookie,
      clearCookie,
    };
  }

  it('keeps refresh tokens out of login and refresh response bodies', async () => {
    const loginResponse = response();
    await expect(
      controller.login(
        { email: 'user@example.com', password: 'password' },
        loginResponse.value,
      ),
    ).resolves.toEqual({
      user: session.user,
      access_token: session.access_token,
    });
    expect(loginResponse.cookie).toHaveBeenCalledWith(
      'orbit_refresh',
      session.refresh_token,
      expect.objectContaining({
        httpOnly: true,
        sameSite: 'strict',
        path: '/auth',
        maxAge: 30 * 24 * 60 * 60 * 1000,
      }),
    );

    const refreshResponse = response();
    await expect(
      controller.refresh(
        {
          headers: { cookie: 'other=x; orbit_refresh=incoming-token' },
        } as Request,
        refreshResponse.value,
      ),
    ).resolves.toEqual({
      user: session.user,
      access_token: session.access_token,
    });
    expect(refreshToken).toHaveBeenCalledWith('incoming-token');
    expect(refreshResponse.cookie).toHaveBeenCalled();
  });

  it('revokes the cookie session and expires the browser cookie on logout', async () => {
    const logoutResponse = response();
    await controller.logout(
      { headers: { cookie: 'orbit_refresh=logout-token' } } as Request,
      logoutResponse.value,
    );

    expect(logout).toHaveBeenCalledWith('logout-token');
    expect(logoutResponse.clearCookie).toHaveBeenCalledWith(
      'orbit_refresh',
      expect.objectContaining({
        httpOnly: true,
        sameSite: 'strict',
        path: '/auth',
      }),
    );
  });
});
