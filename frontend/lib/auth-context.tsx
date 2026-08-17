'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import {
  API_BASE,
  AUTH_SESSION_EVENT,
  apiFetch,
  clearStoredSession,
  storeSession,
} from '@/lib/api';

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
  refreshProfile: () => Promise<void>;
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

    const restoreSession = async () => {
      if (!storedToken) {
        setIsLoading(false);
        return;
      }

      setToken(storedToken);

      try {
        const freshUser = await apiFetch<User>('/auth/me');
        localStorage.setItem('auth_user', JSON.stringify(freshUser));
        setUser(freshUser);
      } catch {
        // Network / parse error — server may be temporarily unreachable.
        // Use stale data as a best-effort fallback only when the server couldn't respond at all.
        if (localStorage.getItem('auth_token') && storedUser) {
          setUser(JSON.parse(storedUser));
        } else {
          setToken(null);
          setUser(null);
        }
      } finally {
        setIsLoading(false);
      }
    };

    void restoreSession();

    const syncSession = () => {
      const currentToken = localStorage.getItem('auth_token');
      const currentUser = localStorage.getItem('auth_user');
      setToken(currentToken);
      setUser(currentUser ? (JSON.parse(currentUser) as User) : null);
    };
    window.addEventListener(AUTH_SESSION_EVENT, syncSession);
    return () => window.removeEventListener(AUTH_SESSION_EVENT, syncSession);
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
      storeSession({ access_token, refresh_token, user: userData });

      setToken(access_token);
      setUser(userData);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    clearStoredSession();
    setToken(null);
    setUser(null);
  };

  const refreshProfile = async () => {
    const freshUser = await apiFetch<User>('/auth/me');
    localStorage.setItem('auth_user', JSON.stringify(freshUser));
    setUser(freshUser);
  };

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, logout, refreshProfile, isAuthenticated: !!token }}>
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
