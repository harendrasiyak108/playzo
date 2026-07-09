import React, { createContext, useContext, useEffect, useState } from "react";
import { storage } from "@/src/utils/storage";

function decodeJWT(token: string): any | null {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const payload = parts[1];
    const json = Buffer.from(payload.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
    return JSON.parse(json);
  } catch (e) {
    return null;
  }
}

type User = { id: string; name?: string | null; email?: string | null } | null;

type AuthContextValue = {
  user: User;
  loading: boolean;
  logout: () => Promise<void>;
  setUser: (u: User) => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUserState] = useState<User>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const token = await storage.secureGet<string | null>("auth_token", null);
      const stored = await storage.getItem<User>("current_user", null);
      if (stored) {
        setUserState(stored);
      } else if (token) {
        try {
          const decoded: any = decodeJWT(token);
          if (decoded) setUserState({ id: decoded.sub, email: decoded.email });
        } catch (e) {
          setUserState(null);
        }
      }
      setLoading(false);
    })();
  }, []);

  const logout = async () => {
    await storage.secureRemove("auth_token");
    await storage.removeItem("current_user");
    setUserState(null);
  };

  const setUser = async (u: User) => {
    setUserState(u);
    if (u) await storage.setItem("current_user", u);
    else await storage.removeItem("current_user");
  };

  return <AuthContext.Provider value={{ user, loading, logout, setUser }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
