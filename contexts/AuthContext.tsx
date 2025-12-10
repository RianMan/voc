import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User } from '../types';

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  isAdmin: boolean;
  canEdit: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // 初始化时检查本地存储的 token
  useEffect(() => {
    const savedToken = localStorage.getItem('voc_token');
    if (savedToken) {
      verifyToken(savedToken);
    } else {
      setLoading(false);
    }
  }, []);

  const verifyToken = async (t: string) => {
    try {
      const res = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${t}` }
      });
      
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
        setToken(t);
      } else {
        localStorage.removeItem('voc_token');
      }
    } catch (e) {
      localStorage.removeItem('voc_token');
    } finally {
      setLoading(false);
    }
  };

  const login = async (username: string, password: string) => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      
      const data = await res.json();
      
      if (res.ok && data.success) {
        setUser(data.user);
        setToken(data.token);
        localStorage.setItem('voc_token', data.token);
        return { success: true };
      } else {
        return { success: false, error: data.error || '登录失败' };
      }
    } catch (e) {
      return { success: false, error: '网络错误' };
    }
  };

  const logout = () => {
    if (token) {
      fetch('/api/auth/logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      }).catch(() => {});
    }
    setUser(null);
    setToken(null);
    localStorage.removeItem('voc_token');
  };

  const isAdmin = user?.role === 'admin';
  const canEdit = user?.role === 'admin' || user?.role === 'operator';

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout, isAdmin, canEdit }}>
      {children}
    </AuthContext.Provider>
  );
};
