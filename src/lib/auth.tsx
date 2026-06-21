import * as React from "react";
import { ApiError, api, getToken, setToken } from "./api";
import type { AuthResponse } from "./types";

interface AuthUser {
  id: number;
  email: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: { firstName: string; lastName: string; email: string; password: string }) => Promise<void>;
  logout: () => void;
}

const USER_KEY = "prospera.user";
const AuthContext = React.createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setTokenState] = React.useState<string | null>(null);
  const [user, setUser] = React.useState<AuthUser | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const t = getToken();
    if (t && typeof window !== "undefined") {
      const raw = window.localStorage.getItem(USER_KEY);
      if (raw) {
        try {
          setUser(JSON.parse(raw));
        } catch {
          /* ignore */
        }
      }
      setTokenState(t);
    }
    setLoading(false);
  }, []);

  const persist = React.useCallback((res: AuthResponse) => {
    const id = res.userId ?? res.id;
    if (id == null) throw new Error("Resposta de login sem identificador de usuario");
    setToken(res.token);
    setTokenState(res.token);
    const u = { id, email: res.email };
    setUser(u);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(USER_KEY, JSON.stringify(u));
    }
  }, []);

  const login = React.useCallback(
    async (email: string, password: string) => {
      try {
        const res = await api<AuthResponse>("/auth/login", { method: "POST", body: { email, password } });
        persist(res);
      } catch (error) {
        if (error instanceof ApiError && error.status === 500 && error.message === "An error occurred") {
          throw new Error("E-mail ou senha inválidos");
        }
        throw error;
      }
    },
    [persist],
  );

  const register = React.useCallback(
    async (data: { firstName: string; lastName: string; email: string; password: string }) => {
      await api("/auth/register", {
        method: "POST",
        body: {
          name: data.firstName,
          lastName: data.lastName,
          monthLimit: 0,
          email: data.email,
          password: data.password,
          role: "USER",
        },
      });
      await login(data.email, data.password);
    },
    [login],
  );

  const logout = React.useCallback(() => {
    setToken(null);
    setTokenState(null);
    setUser(null);
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(USER_KEY);
      window.location.href = "/auth/login";
    }
  }, []);

  const value = React.useMemo<AuthContextValue>(
    () => ({ user, token, loading, login, register, logout }),
    [user, token, loading, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
