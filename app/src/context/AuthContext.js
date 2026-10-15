import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { getItem, setItem, removeItem } from '../storage';
import { setAuthToken, setUnauthorizedHandler } from '../api/client';

const AuthContext = createContext(null);
const TOKEN_KEY = 'purchi_token';
const USER_KEY = 'purchi_user';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const signOut = useCallback(async () => {
    setAuthToken(null);
    setUser(null);
    await removeItem(TOKEN_KEY);
    await removeItem(USER_KEY);
  }, []);

  const signIn = useCallback(async ({ token, user: u }) => {
    setAuthToken(token);
    setUser(u);
    await setItem(TOKEN_KEY, token);
    await setItem(USER_KEY, JSON.stringify(u));
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(signOut);
    (async () => {
      try {
        const token = await getItem(TOKEN_KEY);
        const saved = await getItem(USER_KEY);
        if (token && saved) {
          setAuthToken(token);
          setUser(JSON.parse(saved));
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [signOut]);

  return <AuthContext.Provider value={{ user, loading, signIn, signOut }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
