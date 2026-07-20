import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import type { Seller } from './api';

const TOKEN_KEY = 'escrow_token';
const SELLER_KEY = 'escrow_seller';

interface AuthContextValue {
  token: string | null;
  seller: Seller | null;
  isAuthenticated: boolean;
  login: (token: string, seller: Seller) => void;
  logout: () => void;
  setSeller: (seller: Seller) => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function readStoredSeller(): Seller | null {
  const raw = localStorage.getItem(SELLER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Seller;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [seller, setSellerState] = useState<Seller | null>(readStoredSeller);

  const login = useCallback((newToken: string, newSeller: Seller) => {
    localStorage.setItem(TOKEN_KEY, newToken);
    localStorage.setItem(SELLER_KEY, JSON.stringify(newSeller));
    setToken(newToken);
    setSellerState(newSeller);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(SELLER_KEY);
    setToken(null);
    setSellerState(null);
  }, []);

  const setSeller = useCallback((newSeller: Seller) => {
    localStorage.setItem(SELLER_KEY, JSON.stringify(newSeller));
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
  return localStorage.getItem(TOKEN_KEY);
}

export function getAuthHeader(): Record<string, string> {
  const token = getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}
