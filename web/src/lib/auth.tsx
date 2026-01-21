import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "auth.token";

type AuthContextValue = {
  token: string | null;
  setToken: (token: string) => void;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [token, setTokenState] = useState<string | null>(() =>
    localStorage.getItem(STORAGE_KEY)
  );

  const setToken = (value: string) => {
    localStorage.setItem(STORAGE_KEY, value);
    setTokenState(value);
  };

  const logout = () => {
    localStorage.removeItem(STORAGE_KEY);
    setTokenState(null);
  };

  useEffect(() => {
    const listener = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) {
        setTokenState(event.newValue);
      }
    };
    window.addEventListener("storage", listener);
    return () => window.removeEventListener("storage", listener);
  }, []);

  const value = useMemo(
    () => ({
      token,
      setToken,
      logout,
    }),
    [token]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("AuthProvider が見つかりません");
  }
  return ctx;
};
