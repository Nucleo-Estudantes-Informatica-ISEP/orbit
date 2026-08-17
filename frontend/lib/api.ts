export const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
export const AUTH_SESSION_EVENT = 'orbit-auth-session';

interface SessionResponse {
  access_token: string;
  refresh_token: string;
  user: unknown;
}

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('auth_token');
}

function getRefreshToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('refresh_token');
}

function notifySessionChange() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(AUTH_SESSION_EVENT));
  }
}

export function clearStoredSession() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('auth_token');
  localStorage.removeItem('refresh_token');
  localStorage.removeItem('auth_user');
  notifySessionChange();
}

export function storeSession(session: SessionResponse) {
  if (typeof window === 'undefined') return;
  localStorage.setItem('auth_token', session.access_token);
  localStorage.setItem('refresh_token', session.refresh_token);
  localStorage.setItem('auth_user', JSON.stringify(session.user));
  notifySessionChange();
}

function redirectToLogin() {
  if (typeof window !== 'undefined') {
    window.location.assign(new URL('/login', window.location.origin));
  }
}

let refreshPromise: Promise<string> | null = null;

export function refreshSession(): Promise<string> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    const refreshToken = getRefreshToken();
    if (!refreshToken) throw new Error('No refresh token');

    const response = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });

    if (!response.ok) {
      clearStoredSession();
      redirectToLogin();
      throw new Error('Sessão expirada. Por favor, faz login novamente.');
    }

    const session = (await response.json()) as SessionResponse;
    if (!session.access_token || !session.refresh_token || !session.user) {
      clearStoredSession();
      redirectToLogin();
      throw new Error('Resposta de sessão inválida.');
    }

    storeSession(session);
    return session.access_token;
  })().finally(() => {
    refreshPromise = null;
  });

  return refreshPromise;
}

async function authenticatedFetch(
  url: string,
  options: RequestInit,
  allowRefresh = true,
): Promise<Response> {
  const headers = new Headers(options.headers);
  const token = getToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const response = await fetch(url, { ...options, headers });
  if (response.status !== 401) return response;

  const refreshToken = getRefreshToken();
  if (!allowRefresh || !refreshToken) {
    clearStoredSession();
    redirectToLogin();
    return response;
  }

  const accessToken = await refreshSession();
  const retryHeaders = new Headers(options.headers);
  retryHeaders.set('Authorization', `Bearer ${accessToken}`);
  const retryResponse = await fetch(url, { ...options, headers: retryHeaders });
  if (retryResponse.status === 401) {
    clearStoredSession();
    redirectToLogin();
  }
  return retryResponse;
}

export async function apiFetch<T = unknown>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const res = await authenticatedFetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(text || `HTTP ${res.status}`);
  }
  // 204 No Content
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export function getFileUrl(key: string): string {
  if (typeof window === 'undefined') return `${API_BASE}/files/${key}`;
  const token = localStorage.getItem('auth_token');
  return `${API_BASE}/files/${key}?token=${encodeURIComponent(token ?? '')}`;
}

/** Resolve a stored URL/value to a downloadable file URL.
 *  - Old persisted file URL with expired token → extracts key, regenerates fresh
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

export const api = {
  get: <T = unknown>(path: string) => apiFetch<T>(path),
  post: <T = unknown>(path: string, body: unknown) =>
    apiFetch<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  put: <T = unknown>(path: string, body: unknown) =>
    apiFetch<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
  del: <T = unknown>(path: string) =>
    apiFetch<T>(path, { method: 'DELETE' }),
  downloadPdf: async (path: string, filename: string) => {
    const res = await authenticatedFetch(`${API_BASE}${path}`, {});
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
    const res = await authenticatedFetch(`${API_BASE}${path}`, {
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
