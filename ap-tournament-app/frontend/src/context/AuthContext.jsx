import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../utils/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('ap_token');
    if (!token) { setLoading(false); return; }
    api.me()
      .then(({ user: u }) => setUser(u))
      .catch(() => localStorage.removeItem('ap_token'))
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email, password) => {
    const { token, user: u } = await api.login({ email, password });
    localStorage.setItem('ap_token', token);
    setUser(u);
    return u;
  }, []);

  const register = useCallback(async (name, email, password) => {
    const { token, user: u } = await api.register({ name, email, password });
    localStorage.setItem('ap_token', token);
    setUser(u);
    return u;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('ap_token');
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth requires AuthProvider');
  return ctx;
}
