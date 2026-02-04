import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "auth.token";
const CHILD_STORAGE_KEY = "auth.childId";

type AuthContextValue = {
  token: string | null;
  setToken: (token: string) => void;
  childId: string | null;
  setChildId: (childId: string | null) => void;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [token, setTokenState] = useState<string | null>(() =>
    localStorage.getItem(STORAGE_KEY)
  );
  const [childId, setChildIdState] = useState<string | null>(() =>
    localStorage.getItem(CHILD_STORAGE_KEY)
  );

  const setToken = (value: string) => {
    localStorage.setItem(STORAGE_KEY, value);
    setTokenState(value);
  };

  const setChildId = (value: string | null) => {
    if (value) {
      localStorage.setItem(CHILD_STORAGE_KEY, value);
    } else {
      localStorage.removeItem(CHILD_STORAGE_KEY);
    }
    setChildIdState(value);
  };

  const logout = () => {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(CHILD_STORAGE_KEY);
    setTokenState(null);
    setChildIdState(null);
  };

  useEffect(() => {
    const listener = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) {
        setTokenState(event.newValue);
      }
      if (event.key === CHILD_STORAGE_KEY) {
        setChildIdState(event.newValue);
      }
    };
    window.addEventListener("storage", listener);
    return () => window.removeEventListener("storage", listener);
  }, []);

  const value = useMemo(
    () => ({
      token,
      setToken,
      childId,
      setChildId,
      logout,
    }),
    [token, childId]
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
