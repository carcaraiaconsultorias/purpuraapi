import React, { createContext, useCallback, useContext, useEffect, useState } from "react";

interface User {
  email: string;
  name: string;
  company: string;
  loginTime: number;
}

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  isAuthenticated: boolean;
  authReady: boolean;
  loginAttempts: number;
  isLocked: boolean;
  lockoutEndTime: number | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "http://localhost:3001").replace(/\/+$/, "");
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 5 * 60 * 1000;
const SESSION_TIMEOUT_MS = 24 * 60 * 60 * 1000;

function normalizeText(value: unknown, maxLength = 300) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

async function requestJson(path: string, options: RequestInit = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  const json = await response.json().catch(() => ({}));
  return { response, json };
}

function toUser(payload: any): User {
  return {
    email: normalizeText(payload?.email, 180).toLowerCase(),
    name: normalizeText(payload?.name, 180) || "Administradora Purpura",
    company: normalizeText(payload?.company, 180) || "Agencia Purpura",
    loginTime: Date.now(),
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [authReady, setAuthReady] = useState(false);
  const [user, setUser] = useState<User | null>(() => {
    const stored = localStorage.getItem("carcara_user");
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed.loginTime && Date.now() - parsed.loginTime > SESSION_TIMEOUT_MS) {
        localStorage.removeItem("carcara_user");
        return null;
      }
      return parsed;
    }
    return null;
  });

  const [loginAttempts, setLoginAttempts] = useState<number>(() => {
    const stored = localStorage.getItem("carcara_login_attempts");
    return stored ? parseInt(stored, 10) : 0;
  });

  const [lockoutEndTime, setLockoutEndTime] = useState<number | null>(() => {
    const stored = localStorage.getItem("carcara_lockout_end");
    if (stored) {
      const endTime = parseInt(stored, 10);
      if (Date.now() < endTime) return endTime;
      localStorage.removeItem("carcara_lockout_end");
      localStorage.removeItem("carcara_login_attempts");
    }
    return null;
  });

  const isLocked = lockoutEndTime !== null && Date.now() < lockoutEndTime;

  useEffect(() => {
    if (lockoutEndTime && Date.now() >= lockoutEndTime) {
      setLockoutEndTime(null);
      setLoginAttempts(0);
      localStorage.removeItem("carcara_lockout_end");
      localStorage.removeItem("carcara_login_attempts");
    }
  }, [lockoutEndTime]);

  useEffect(() => {
    if (!lockoutEndTime) return undefined;
    const interval = setInterval(() => {
      if (Date.now() >= lockoutEndTime) {
        setLockoutEndTime(null);
        setLoginAttempts(0);
        localStorage.removeItem("carcara_lockout_end");
        localStorage.removeItem("carcara_login_attempts");
      }
    }, 1_000);
    return () => clearInterval(interval);
  }, [lockoutEndTime]);

  useEffect(() => {
    let cancelled = false;

    const checkSession = async () => {
      try {
        const { response, json } = await requestJson("/auth/me", { method: "GET" });
        if (!response.ok || !json?.ok) {
          if (!cancelled) {
            setUser(null);
            localStorage.removeItem("carcara_user");
          }
          return;
        }

        if (!cancelled) {
          const sessionUser = toUser(json.user || {});
          setUser(sessionUser);
          localStorage.setItem("carcara_user", JSON.stringify(sessionUser));
        }
      } catch {
        if (!cancelled) {
          setUser(null);
          localStorage.removeItem("carcara_user");
        }
      } finally {
        if (!cancelled) setAuthReady(true);
      }
    };

    void checkSession();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    if (isLocked) {
      const remainingSeconds = Math.ceil((lockoutEndTime! - Date.now()) / 1_000);
      const remainingMinutes = Math.ceil(remainingSeconds / 60);
      return {
        success: false,
        error: `Conta bloqueada por tentativas excessivas. Tente novamente em ${remainingMinutes} minuto(s).`,
      };
    }

    try {
      const { response, json } = await requestJson("/auth/login", {
        method: "POST",
        body: JSON.stringify({
          username: normalizeText(email, 200).toLowerCase(),
          password: normalizeText(password, 400),
        }),
      });

      if (!response.ok || !json?.ok) {
        const newAttempts = loginAttempts + 1;
        setLoginAttempts(newAttempts);
        localStorage.setItem("carcara_login_attempts", newAttempts.toString());

        if (newAttempts >= MAX_LOGIN_ATTEMPTS) {
          const lockoutEnd = Date.now() + LOCKOUT_DURATION_MS;
          setLockoutEndTime(lockoutEnd);
          localStorage.setItem("carcara_lockout_end", lockoutEnd.toString());
          return {
            success: false,
            error: "Muitas tentativas de login. Conta bloqueada por 5 minutos.",
          };
        }

        const remainingAttempts = MAX_LOGIN_ATTEMPTS - newAttempts;
        return {
          success: false,
          error: normalizeText(json?.error, 240) || `Credenciais invalidas. ${remainingAttempts} tentativa(s) restante(s).`,
        };
      }

      const userData: User = toUser(json.user || { email });
      setUser(userData);
      localStorage.setItem("carcara_user", JSON.stringify(userData));
      setLoginAttempts(0);
      localStorage.removeItem("carcara_login_attempts");
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Erro ao fazer login",
      };
    }
  }, [isLocked, lockoutEndTime, loginAttempts]);

  const logout = useCallback(() => {
    setUser(null);
    localStorage.removeItem("carcara_user");
    void requestJson("/auth/logout", { method: "POST" }).catch(() => {});
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        logout,
        isAuthenticated: !!user,
        authReady,
        loginAttempts,
        isLocked,
        lockoutEndTime,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
