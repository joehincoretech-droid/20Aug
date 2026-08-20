import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { api, clearSession, getStoredUser, getToken, setSession } from '../api';
import type { User } from '../types';

interface AuthContextValue {
  user: User | null;
  ready: boolean;
  login: (username: string, password: string) => Promise<User>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(getStoredUser());
  const [ready, setReady] = useState(false);

  useEffect(() => {
    async function hydrate() {
      if (!getToken()) {
        setReady(true);
        return;
      }
      try {
        const data = await api<{ user: User }>('/api/auth/me');
        setUser(data.user);
        const token = getToken();
        if (token) setSession(token, data.user);
      } catch {
        clearSession();
        setUser(null);
      } finally {
        setReady(true);
      }
    }
    hydrate();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      ready,
      async login(username, password) {
        const data = await api<{ token: string; user: User }>('/api/auth/login', {
          method: 'POST',
          body: { username, password },
        });
        setSession(data.token, data.user);
        setUser(data.user);
        return data.user;
      },
      logout() {
        clearSession();
        setUser(null);
      },
    }),
    [user, ready]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
