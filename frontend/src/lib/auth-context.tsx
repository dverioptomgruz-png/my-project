'use client';

import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';

const API_URL = '';

interface User {
  id: string;
  email: string;
  name?: string;
  role: string;
}

interface AuthState {
  user: User | null;
  isLoading: boolean;
  error: string | null;
}

interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name?: string) => Promise<void>;
  logout: () => void;
  refreshAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({ user: null, isLoading: true, error: null });

  const fetchProfile = useCallback(async () => {
    const token = localStorage.getItem('accessToken');
    if (!token) {
      setState({ user: null, isLoading: false, error: null });
      return;
    }
    try {
      const res = await fetch(`${API_URL}/api/auth/profile`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setState({ user: data, isLoading: false, error: null });
      } else {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        setState({ user: null, isLoading: false, error: null });
      }
    } catch {
      setState({ user: null, isLoading: false, error: null });
    }
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Login failed');
    }
    const data = await res.json();
    localStorage.setItem('accessToken', data.accessToken);
    localStorage.setItem('refreshToken', data.refreshToken);
    setState({ user: data.user, isLoading: false, error: null });
  }, []);

  const register = useCallback(async (email: string, password: string, name?: string) => {
    const res = await fetch(`${API_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, name }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Registration failed');
    }
    const data = await res.json();
    localStorage.setItem('accessToken', data.accessToken);
    localStorage.setItem('refreshToken', data.refreshToken);
    setState({ user: data.user, isLoading: false, error: null });
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    setState({ user: null, isLoading: false, error: null });
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setState(prev => prev.isLoading ? { ...prev, isLoading: false } : prev);
    }, 3000);
    fetchProfile();
    return () => clearTimeout(timer);
  }, [fetchProfile]);

  const value = useMemo(() => ({
    ...state,
    login,
    register,
    logout,
    refreshAuth: fetchProfile,
  }), [state, login, register, logout, fetchProfile]);

  return React.createElement(AuthContext.Provider, { value }, children);
}
