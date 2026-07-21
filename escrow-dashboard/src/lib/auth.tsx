import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import type { Seller } from './api';

const TOKEN_KEY = 'escrow_token';
const SELLER_KEY = 'escrow_seller';

interface AuthContextValue {
  token: string | null;
  seller: Seller | null;
  isAuthenticated: boolean;
  login: (token: string, seller: Seller, remember?: boolean) => void;
  logout: () => void;
  setSeller: (seller: Seller) => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function readStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY) ?? sessionStorage.getItem(TOKEN_KEY);
}

function readStoredSeller(): Seller | null {
  const raw = localStorage.getItem(SELLER_KEY) ?? sessionStorage.getItem(SELLER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Seller;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(readStoredToken);
  const [seller, setSellerState] = useState<Seller | null>(readStoredSeller);

  // remember=true persists across browser restarts (localStorage); false
  // clears on tab/browser close (sessionStorage) — the "keep me logged in" checkbox.
  const login = useCallback((newToken: string, newSeller: Seller, remember = true) => {
    const store = remember ? localStorage : sessionStorage;
    const other = remember ? sessionStorage : localStorage;
    other.removeItem(TOKEN_KEY);
    other.removeItem(SELLER_KEY);
    store.setItem(TOKEN_KEY, newToken);
    store.setItem(SELLER_KEY, JSON.stringify(newSeller));
    setToken(newToken);
    setSellerState(newSeller);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(SELLER_KEY);
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(SELLER_KEY);
    setToken(null);
    setSellerState(null);
  }, []);

  const setSeller = useCallback((newSeller: Seller) => {
    const store = localStorage.getItem(TOKEN_KEY) ? localStorage : sessionStorage;
    store.setItem(SELLER_KEY, JSON.stringify(newSeller));
    setSellerState(newSeller);
  }, []);

  return (
    <AuthContext.Provider
      value={{ token, seller, isAuthenticated: !!token && !!seller, login, logout, setSeller }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}

/** Standalone accessor for use outside React (e.g. the axios interceptor). */
export function getAuthToken(): string | null {
  return localStorage.getItem(TOKEN_KEY) ?? sessionStorage.getItem(TOKEN_KEY);
}

export function getAuthHeader(): Record<string, string> {
  const token = getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}
