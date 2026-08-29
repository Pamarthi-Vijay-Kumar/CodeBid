import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null); // { type: 'USER'|'TEAM', ...profile }
  const [loading, setLoading] = useState(true);

  const loadSession = useCallback(async () => {
    const token = localStorage.getItem('codebid_token');
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const { data } = await api.get('/auth/me');
      setSession(data.type === 'TEAM' ? { type: 'TEAM', ...data.team } : { type: 'USER', ...data.user });
    } catch {
      localStorage.removeItem('codebid_token');
      setSession(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  const login = (token, profile, type) => {
    localStorage.setItem('codebid_token', token);
    setSession({ type, ...profile });
  };

  const logout = () => {
    localStorage.removeItem('codebid_token');
    setSession(null);
  };

  return (
    <AuthContext.Provider value={{ session, loading, login, logout, refresh: loadSession }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
