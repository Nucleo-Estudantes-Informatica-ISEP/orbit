'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { API_BASE, refreshAccessToken } from '@/lib/api';

export interface User {
  id: string;
  email: string;
  name: string;
  roles: string[];
  permissions?: string[];
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Restore token and user from localStorage on mount
  useEffect(() => {
    const storedToken = localStorage.getItem('auth_token');
    const storedUser = localStorage.getItem('auth_user');
    const storedRefreshToken = localStorage.getItem('auth_refresh_token');

    const restoreSession = async () => {
      if (!storedToken && !storedRefreshToken) {
        setIsLoading(false);
        return;
      }

      if (storedToken) setToken(storedToken);

      try {
        let activeToken = storedToken;
        let response = activeToken
          ? await fetch(`${API_BASE}/auth/me`, {
              headers: { Authorization: `Bearer ${activeToken}` },
            })
          : null;

        // If the access token expired (or only a refresh token remains),
        // silently obtain a new access token before forcing a re-login.
        if (!response || response.status === 401) {
          activeToken = await refreshAccessToken();
          if (activeToken) {
            setToken(activeToken);
            response = await fetch(`${API_BASE}/auth/me`, {
              headers: { Authorization: `Bearer ${activeToken}` },
            });
          }
        }

        if (!response?.ok) {
          localStorage.removeItem('auth_token');
          localStorage.removeItem('auth_refresh_token');
          localStorage.removeItem('auth_user');
          setToken(null);
          setUser(null);
          setIsLoading(false);
          return;
        }

        const freshUser = await response.json();
        localStorage.setItem('auth_user', JSON.stringify(freshUser));
        setUser(freshUser);
      } catch {
        // Network / parse error — server may be temporarily unreachable.
        // Use stale data as a best-effort fallback only when the server couldn't respond at all.
        if (storedUser) {
          setUser(JSON.parse(storedUser));
        } else {
          localStorage.removeItem('auth_token');
          localStorage.removeItem('auth_user');
          setToken(null);
        }
      } finally {
        setIsLoading(false);
      }
    };

    void restoreSession();
  }, []);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        throw new Error('Login failed');
      }

      const data = await response.json();
      const { user: userData, access_token, refresh_token } = data;

      // Store token and user
      localStorage.setItem('auth_token', access_token);
      localStorage.setItem('auth_refresh_token', refresh_token);
      localStorage.setItem('auth_user', JSON.stringify(userData));

      setToken(access_token);
      setUser(userData);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_refresh_token');
    localStorage.removeItem('auth_user');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, logout, isAuthenticated: !!token }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
