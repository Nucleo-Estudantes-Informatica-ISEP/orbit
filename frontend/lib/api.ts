export const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
export const AUTH_SESSION_EVENT = 'orbit-auth-session';

interface SessionResponse {
  access_token: string;
  refresh_token: string;
  user: unknown;
}

export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('auth_token');
}

function getRefreshToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('auth_refresh_token');
}

function notifySessionChange() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(AUTH_SESSION_EVENT));
  }
}

export function clearStoredSession() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('auth_token');
  localStorage.removeItem('auth_refresh_token');
  localStorage.removeItem('auth_user');
  notifySessionChange();
}

export function storeSession(session: SessionResponse) {
  if (typeof window === 'undefined') return;
  localStorage.setItem('auth_token', session.access_token);
  localStorage.setItem('auth_refresh_token', session.refresh_token);
  localStorage.setItem('auth_user', JSON.stringify(session.user));
  notifySessionChange();
}

function redirectToLogin() {
  if (typeof window !== 'undefined') {
    window.location.assign(new URL('/login', window.location.origin));
  }
}

function clearAuthAndRedirect(): never {
  clearStoredSession();
  redirectToLogin();
  throw new Error('Sessão expirada. Por favor, faz login novamente.');
}

export function revokeStoredSession() {
  const refreshToken = getRefreshToken();
  if (refreshToken) {
    void fetch(`${API_BASE}/auth/logout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
      keepalive: true,
    }).catch(() => {});
  }
  clearStoredSession();
}

let refreshPromise: Promise<string> | null = null;

async function exchangeRefreshToken(observedRefreshToken: string): Promise<string> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) clearAuthAndRedirect();

  // Another tab may have completed rotation while this one waited for the lock.
  if (refreshToken !== observedRefreshToken) {
    const currentAccessToken = getToken();
    if (currentAccessToken) return currentAccessToken;
  }

  const res = await fetch(`${API_BASE}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });

  if (res.status === 401 || res.status === 403) clearAuthAndRedirect();
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new ApiError(text || `HTTP ${res.status}`, res.status);
  }

  const data = (await res.json()) as Partial<SessionResponse>;
  if (!data.access_token || !data.refresh_token || !data.user) {
    clearAuthAndRedirect();
  }

  storeSession(data as SessionResponse);
  return data.access_token;
}

/**
 * Rotate the long-lived refresh token and obtain a new access token.
 * A shared promise deduplicates requests in this tab; Web Locks deduplicate
 * rotation across tabs that share the same localStorage session.
 */
export async function refreshAccessToken(): Promise<string> {
  if (typeof window === 'undefined') {
    throw new Error('Refresh is only available in the browser');
  }
  if (refreshPromise) return refreshPromise;

  const observedRefreshToken = getRefreshToken();
  if (!observedRefreshToken) clearAuthAndRedirect();

  const rotate = () => exchangeRefreshToken(observedRefreshToken);
  const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined;
  const lockedRotation = locks
    ? locks.request<Promise<string>>('orbit-auth-refresh', rotate).then((token) => token)
    : rotate();
  const promise = lockedRotation.finally(() => {
    refreshPromise = null;
  });
  refreshPromise = promise;

  return promise;
}

async function fetchWithAccessToken(path: string, options: RequestInit, token: string | null): Promise<Response> {
  return fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
  });
}

export async function apiFetch<T = unknown>(path: string, options: RequestInit = {}): Promise<T> {
  let res = await fetchWithAccessToken(path, options, getToken());

  if (res.status === 401) {
    const newToken = await refreshAccessToken();
    res = await fetchWithAccessToken(path, options, newToken);
  }

  if (res.status === 401) clearAuthAndRedirect();

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new ApiError(text || `HTTP ${res.status}`, res.status);
  }
  // 204 No Content
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export function getFileUrl(key: string): string {
  return `/file?key=${encodeURIComponent(key)}`;
}

/** Resolve a stored URL/value to a downloadable file URL.
 *  - Old persisted file URL with expired token → extracts key, removes credentials
 *  - MinIO object key (no protocol) → wraps with getFileUrl
 *  - External URL (https://…) → returned as-is */
export function resolveFileUrl(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  const filePrefix = `${API_BASE}/files/`;
  if (value.startsWith(filePrefix)) {
    const key = value.slice(filePrefix.length).split('?')[0].split('#')[0];
    return getFileUrl(key);
  }
  if (!/^https?:\/\//i.test(value)) return getFileUrl(value);
  return value;
}

async function authorizedBinaryFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const request = async (token: string | null) =>
    fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers ?? {}),
      },
    });

  let res = await request(getToken());
  if (res.status === 401) {
    const newToken = await refreshAccessToken();
    res = await request(newToken);
  }
  if (res.status === 401) clearAuthAndRedirect();
  return res;
}

export async function fetchFileBlob(key: string, signal?: AbortSignal): Promise<Blob> {
  const parts = key.split('/');
  if (!key || parts.some((part) => part === '.' || part === '..')) {
    throw new Error('Invalid file key');
  }
  const res = await authorizedBinaryFetch(`/files/${parts.map(encodeURIComponent).join('/')}`, {
    signal,
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`File request failed: HTTP ${res.status}`);
  // ponytail: buffers files (uploads max 10 MB); stream downloads if that limit grows.
  return res.blob();
}

export const api = {
  get: <T = unknown>(path: string) => apiFetch<T>(path),
  post: <T = unknown>(path: string, body: unknown) => apiFetch<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  put: <T = unknown>(path: string, body: unknown) => apiFetch<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
  del: <T = unknown>(path: string) => apiFetch<T>(path, { method: 'DELETE' }),
  downloadPdf: async (path: string, filename: string) => {
    const res = await authorizedBinaryFetch(path);
    if (!res.ok) throw new Error(`Download failed: HTTP ${res.status}`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },
  upload: async <T = unknown>(path: string, file: File): Promise<T> => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await authorizedBinaryFetch(path, {
      method: 'POST',
      // Do NOT set Content-Type — browser sets multipart boundary automatically
      body: formData,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText);
      throw new Error(text || `HTTP ${res.status}`);
    }
    if (res.status === 204) return undefined as T;
    return res.json() as Promise<T>;
  },
};
