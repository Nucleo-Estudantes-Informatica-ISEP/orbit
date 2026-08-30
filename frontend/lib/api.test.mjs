import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import {
  ApiError,
  apiFetch,
  clearStoredSession,
  refreshSession,
  storeSession,
} from './api.ts';

class MemoryStorage {
  #items = new Map();

  getItem(key) {
    return this.#items.get(key) ?? null;
  }

  setItem(key, value) {
    this.#items.set(key, String(value));
  }

  removeItem(key) {
    this.#items.delete(key);
  }
}

let redirects;

beforeEach(() => {
  globalThis.localStorage = new MemoryStorage();
  redirects = [];
  globalThis.window = Object.assign(new EventTarget(), {
    location: {
      origin: 'https://orbit.example.test',
      assign: (url) => redirects.push(String(url)),
    },
  });
});

test('stores and clears the complete session', () => {
  storeSession({
    access_token: 'access',
    refresh_token: 'refresh',
    user: { id: 'member-id' },
  });

  assert.equal(localStorage.getItem('auth_token'), 'access');
  assert.equal(localStorage.getItem('refresh_token'), 'refresh');
  assert.deepEqual(JSON.parse(localStorage.getItem('auth_user')), {
    id: 'member-id',
  });

  clearStoredSession();
  assert.equal(localStorage.getItem('auth_token'), null);
  assert.equal(localStorage.getItem('refresh_token'), null);
  assert.equal(localStorage.getItem('auth_user'), null);
});

test('rotates and persists a refreshed session', async () => {
  localStorage.setItem('refresh_token', 'old-refresh');
  globalThis.fetch = async (_url, options) => {
    assert.deepEqual(JSON.parse(options.body), {
      refresh_token: 'old-refresh',
    });
    return Response.json({
      access_token: 'new-access',
      refresh_token: 'new-refresh',
      user: { id: 'member-id' },
    });
  };

  assert.equal(await refreshSession(), 'new-access');
  assert.equal(localStorage.getItem('auth_token'), 'new-access');
  assert.equal(localStorage.getItem('refresh_token'), 'new-refresh');
});

test('retries one unauthorized API request with the refreshed access token', async () => {
  localStorage.setItem('auth_token', 'expired-access');
  localStorage.setItem('refresh_token', 'valid-refresh');
  const authorizations = [];
  let call = 0;
  globalThis.fetch = async (_url, options) => {
    call += 1;
    authorizations.push(new Headers(options.headers).get('Authorization'));
    if (call === 1) return new Response(null, { status: 401 });
    if (call === 2) {
      return Response.json({
        access_token: 'fresh-access',
        refresh_token: 'fresh-refresh',
        user: { id: 'member-id' },
      });
    }
    return Response.json({ status: 'ok' });
  };

  await assert.doesNotReject(() => apiFetch('/protected'));
  assert.deepEqual(authorizations, [
    'Bearer expired-access',
    null,
    'Bearer fresh-access',
  ]);
});

test('clears and redirects when the refresh token is rejected', async () => {
  localStorage.setItem('auth_token', 'expired-access');
  localStorage.setItem('refresh_token', 'invalid-refresh');
  localStorage.setItem('auth_user', '{}');
  globalThis.fetch = async () => new Response(null, { status: 401 });

  await assert.rejects(() => apiFetch('/protected'), /Sessão expirada/);
  assert.equal(localStorage.getItem('auth_token'), null);
  assert.equal(localStorage.getItem('refresh_token'), null);
  assert.equal(localStorage.getItem('auth_user'), null);
  assert.deepEqual(redirects, ['https://orbit.example.test/login']);
});

test('preserves HTTP status on API failures', async () => {
  globalThis.fetch = async () =>
    new Response('temporarily unavailable', { status: 503 });

  await assert.rejects(
    () => apiFetch('/auth/me'),
    (error) =>
      error instanceof ApiError &&
      error.status === 503 &&
      error.message === 'temporarily unavailable',
  );
});
