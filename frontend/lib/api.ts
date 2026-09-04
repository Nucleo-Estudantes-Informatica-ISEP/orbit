export const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
export const AUTH_SESSION_EVENT = 'orbit-auth-session';

interface SessionResponse {
  access_token: string;
  user: unknown;
}

const SESSION_MARKER = 'auth_session';

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

export function hasStoredSession(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(SESSION_MARKER) !== null;
}

function notifySessionChange() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(AUTH_SESSION_EVENT));
  }
}

export function clearStoredSession() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('auth_token');
  localStorage.removeItem('auth_user');
  localStorage.removeItem(SESSION_MARKER);
  notifySessionChange();
}

export function storeSession(session: SessionResponse) {
  if (typeof window === 'undefined') return;
  localStorage.setItem('auth_token', session.access_token);
  localStorage.setItem('auth_user', JSON.stringify(session.user));
  if (!localStorage.getItem(SESSION_MARKER)) {
    localStorage.setItem(SESSION_MARKER, crypto.randomUUID());
  }
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
  if (hasStoredSession()) {
    void fetch(`${API_BASE}/auth/logout`, {
      method: 'POST',
      credentials: 'include',
      keepalive: true,
    }).catch(() => {});
  }
  clearStoredSession();
}

let refreshPromise: Promise<string> | null = null;

async function exchangeRefreshToken(observedAccessToken: string | null, sessionMarker: string): Promise<string> {
  if (localStorage.getItem(SESSION_MARKER) !== sessionMarker) clearAuthAndRedirect();

  // Another tab may have completed rotation while this one waited for the lock.
  const currentAccessToken = getToken();
  if (currentAccessToken && currentAccessToken !== observedAccessToken) return currentAccessToken;

  const res = await fetch(`${API_BASE}/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
  });

  if (res.status === 401 || res.status === 403) clearAuthAndRedirect();
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new ApiError(text || `HTTP ${res.status}`, res.status);
  }

  const data = (await res.json()) as Partial<SessionResponse>;
  if (!data.access_token || !data.user) {
    clearAuthAndRedirect();
  }

  // Logout/session replacement while refresh was in flight must win.
  if (localStorage.getItem(SESSION_MARKER) !== sessionMarker) {
    throw new Error('Session changed during refresh');
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

  const sessionMarker = localStorage.getItem(SESSION_MARKER);
  if (!sessionMarker) clearAuthAndRedirect();
  const observedAccessToken = getToken();

  const rotate = () => exchangeRefreshToken(observedAccessToken, sessionMarker);
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

async function authenticatedFetch(path: string, options: RequestInit = {}, json = false): Promise<Response> {
  const request = async (token: string | null) => {
    const headers = new Headers(options.headers);
    if (json && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }
    if (token) headers.set('Authorization', `Bearer ${token}`);
    else headers.delete('Authorization');

    return fetch(`${API_BASE}${path}`, { ...options, headers });
  };

  let response = await request(getToken());
  if (response.status === 401) {
    response = await request(await refreshAccessToken());
  }
  if (response.status === 401) clearAuthAndRedirect();
  return response;
}

export async function apiFetch<T = unknown>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await authenticatedFetch(path, options, true);

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

export async function fetchFileBlob(key: string, signal?: AbortSignal): Promise<Blob> {
  const parts = key.split('/');
  if (!key || parts.some((part) => part === '.' || part === '..')) {
    throw new Error('Invalid file key');
  }
  const res = await authenticatedFetch(`/files/${parts.map(encodeURIComponent).join('/')}`, {
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
    const res = await authenticatedFetch(path);
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
    const res = await authenticatedFetch(path, {
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
