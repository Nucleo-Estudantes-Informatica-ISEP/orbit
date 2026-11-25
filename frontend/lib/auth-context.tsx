"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import {
  API_BASE,
  AUTH_SESSION_EVENT,
  apiFetch,
  hasStoredSession,
  getBrowserSession,
  revokeStoredSession,
  storeSession,
} from "@/lib/api";

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
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;
    localStorage.removeItem("auth_token");
    localStorage.removeItem("auth_user");

    const syncSession = () => {
      const session = getBrowserSession();
      if (session || !hasStoredSession()) {
        setToken(session?.access_token ?? null);
        setUser((session?.user as User | undefined) ?? null);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      void apiFetch<User>("/auth/me")
        .then((profile) => {
          const current = getBrowserSession();
          if (active && current) {
            setToken(current.access_token);
            setUser(profile);
          }
        })
        .catch(() => {
          if (active && !getBrowserSession()) {
            setToken(null);
            setUser(null);
          }
        })
        .finally(() => {
          if (active) setIsLoading(false);
        });
    };

    syncSession();
    window.addEventListener(AUTH_SESSION_EVENT, syncSession);
    window.addEventListener("storage", syncSession);
    return () => {
      active = false;
      window.removeEventListener(AUTH_SESSION_EVENT, syncSession);
      window.removeEventListener("storage", syncSession);
    };
  }, []);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        throw new Error("Login failed");
      }

      const data = await response.json();
      const { user: userData, access_token } = data;

      storeSession({ access_token, user: userData }, true);

      setToken(access_token);
      setUser(userData);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    await revokeStoredSession();
  };

  const refreshProfile = async () => {
    const freshUser = await apiFetch<User>("/auth/me");
    const current = getBrowserSession();
    if (current) storeSession({ access_token: current.access_token, user: freshUser });
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        login,
        logout,
        refreshProfile,
        isAuthenticated: !!token,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
