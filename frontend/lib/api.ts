export const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('auth_token');
}

function getRefreshToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('auth_refresh_token');
}

function clearAuthAndRedirect(): never {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_refresh_token');
    localStorage.removeItem('auth_user');
    window.location.assign(new URL('/login', window.location.origin));
  }
  throw new Error('Sessão expirada. Por favor, faz login novamente.');
}

let refreshPromise: Promise<string | null> | null = null;

/**
 * Exchange the long-lived refresh token for a new access token.
 * A shared promise prevents several simultaneous 401 responses from
 * triggering multiple refresh requests at once.
 */
export async function refreshAccessToken(): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  if (refreshPromise) return refreshPromise;

  const refreshToken = getRefreshToken();
  if (!refreshToken) return null;

  refreshPromise = (async () => {
    try {
      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });

      if (!res.ok) return null;

      const data = (await res.json()) as { access_token?: string };
      if (!data.access_token) return null;

      localStorage.setItem('auth_token', data.access_token);
      return data.access_token;
    } catch {
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

async function fetchWithAccessToken(
  path: string,
  options: RequestInit,
  token: string | null,
): Promise<Response> {
  return fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
  });
}

export async function apiFetch<T = unknown>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  let res = await fetchWithAccessToken(path, options, getToken());

  if (res.status === 401) {
    const newToken = await refreshAccessToken();
    if (!newToken) clearAuthAndRedirect();
    res = await fetchWithAccessToken(path, options, newToken);
  }

  if (res.status === 401) clearAuthAndRedirect();

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

async function authorizedBinaryFetch(
  path: string,
  options: RequestInit = {},
): Promise<Response> {
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
    if (!newToken) clearAuthAndRedirect();
    res = await request(newToken);
  }
  if (res.status === 401) clearAuthAndRedirect();
  return res;
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
