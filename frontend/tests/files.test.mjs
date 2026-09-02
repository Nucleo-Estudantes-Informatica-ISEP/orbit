import assert from 'node:assert/strict';
import { test } from 'node:test';
import { API_BASE, fetchFileBlob, getFileUrl, resolveFileUrl } from '../lib/api.ts';

test('authenticated files', async (t) => {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const storage = new Map();
  const redirects = [];
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value),
      removeItem: (key) => storage.delete(key),
    },
  });
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { location: { origin: 'https://orbit.test', assign: (url) => redirects.push(String(url)) } },
  });
  t.after(() => {
    for (const [name, descriptor] of [['window', originalWindow], ['localStorage', originalStorage]]) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else delete globalThis[name];
    }
  });
  const reset = () => {
    storage.set('auth_token', 'expired');
    storage.set('auth_refresh_token', 'refresh-token');
    storage.set('auth_user', '{}');
    redirects.length = 0;
  };

  await t.test('links stay token-free and preserve external URLs', () => {
    reset();
    const key = 'folder/CV & photo.png';
    const url = getFileUrl(key);
    storage.set('auth_token', 'replacement');
    assert.equal(getFileUrl(key), url);
    assert.equal(new URL(url, window.location.origin).searchParams.get('key'), key);
    assert.equal(resolveFileUrl(`${API_BASE}/files/cv.pdf?token=old#page=1`), '/file?key=cv.pdf');
    assert.equal(resolveFileUrl('cv.pdf'), '/file?key=cv.pdf');
    assert.equal(resolveFileUrl('https://external.test/cv.pdf'), 'https://external.test/cv.pdf');
    assert.equal(resolveFileUrl(null), undefined);
  });

  await t.test('expired image and PDF requests share a refresh and retry with the new token', async (t) => {
    reset();
    let refreshes = 0;
    const fileRequests = [];
    t.mock.method(globalThis, 'fetch', async (url, options) => {
      if (url === `${API_BASE}/auth/refresh`) {
        refreshes++;
        assert.equal(JSON.parse(options.body).refresh_token, 'refresh-token');
        return Response.json({ access_token: 'fresh' });
      }
      const authorization = new Headers(options.headers).get('Authorization');
      fileRequests.push({ url, authorization });
      assert.equal(new URL(url, window.location.origin).search, '');
      if (authorization === 'Bearer expired') return new Response(null, { status: 401 });
      assert.equal(authorization, 'Bearer fresh');
      return new Response('file bytes', { headers: { 'Content-Type': url.endsWith('.png') ? 'image/png' : 'application/pdf' } });
    });
    const [image, pdf] = await Promise.all([fetchFileBlob('photo.png'), fetchFileBlob('folder/CV & file.pdf')]);
    assert.equal(image.type, 'image/png');
    assert.equal(pdf.type, 'application/pdf');
    assert.equal(await pdf.text(), 'file bytes');
    assert.equal(refreshes, 1);
    assert.equal(fileRequests.length, 4);
    assert.equal(fileRequests.at(-1).url, `${API_BASE}/files/folder/CV%20%26%20file.pdf`);
    assert.equal(storage.get('auth_token'), 'fresh');
  });

  await t.test('revoked refresh tokens clear the session and redirect', async (t) => {
    reset();
    t.mock.method(globalThis, 'fetch', async () => new Response(null, { status: 401 }));
    await assert.rejects(fetchFileBlob('cv.pdf'), /Sessão expirada/);
    assert.equal(storage.size, 0);
    assert.deepEqual(redirects, ['https://orbit.test/login']);
  });

  await t.test('missing files do not refresh or clear authentication', async (t) => {
    reset();
    const fetch = t.mock.method(globalThis, 'fetch', async () => new Response(null, { status: 404 }));
    await assert.rejects(fetchFileBlob('missing.pdf'), /HTTP 404/);
    assert.equal(fetch.mock.callCount(), 1);
    assert.equal(storage.size, 3);
    assert.deepEqual(redirects, []);
  });

  await t.test('cancellation is forwarded and traversal is rejected without fetching', async (t) => {
    reset();
    const controller = new AbortController();
    controller.abort();
    const fetch = t.mock.method(globalThis, 'fetch', async (_url, options) => {
      assert.equal(options.signal, controller.signal);
      options.signal.throwIfAborted();
    });
    await assert.rejects(fetchFileBlob('photo.png', controller.signal), { name: 'AbortError' });
    for (const key of ['', '..', '../auth/me', 'folder/../photo.png']) {
      await assert.rejects(fetchFileBlob(key), /Invalid file key/);
    }
    assert.equal(fetch.mock.callCount(), 1);
  });
});
