import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { api, clearSession, getStoredUser, getToken, setSession } from '../api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(getStoredUser());
  const [ready, setReady] = useState(false);

  useEffect(() => {
    async function hydrate() {
      if (!getToken()) {
        setReady(true);
        return;
      }
      try {
        const data = await api('/api/auth/me');
        setUser(data.user);
        setSession(getToken(), data.user);
      } catch {
        clearSession();
        setUser(null);
      } finally {
        setReady(true);
      }
    }
    hydrate();
  }, []);

  const value = useMemo(
    () => ({
      user,
      ready,
      async login(username, password) {
        const data = await api('/api/auth/login', {
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

export function useAuth() {
  return useContext(AuthContext);
}
