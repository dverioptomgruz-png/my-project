'use client';

import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';

const API_URL = (process.env.NEXT_PUBLIC_API_URL || '/api').replace(/\/+$/, '');

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

  const tryRefreshToken = useCallback(async (): Promise<string | null> => {
    const refreshToken = localStorage.getItem('refreshToken');
    if (!refreshToken) return null;

    try {
      const response = await fetch(`${API_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });

      if (!response.ok) return null;

      const payload = await response.json();
      const accessToken = payload.accessToken || payload.access_token;
      const newRefreshToken = payload.refreshToken || payload.refresh_token;
      if (!accessToken) return null;

      localStorage.setItem('accessToken', accessToken);
      if (newRefreshToken) {
        localStorage.setItem('refreshToken', newRefreshToken);
      }
      return accessToken;
    } catch {
      return null;
    }
  }, []);

  const fetchProfile = useCallback(async () => {
    let token = localStorage.getItem('accessToken');
    if (!token) {
      setState({ user: null, isLoading: false, error: null });
      return;
    }

    try {
      let res = await fetch(`${API_URL}/auth/profile`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.status === 401) {
        const refreshedToken = await tryRefreshToken();
        if (!refreshedToken) {
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          setState({ user: null, isLoading: false, error: null });
          return;
        }

        token = refreshedToken;
        res = await fetch(`${API_URL}/auth/profile`, {
          headers: { Authorization: `Bearer ${token}` },
        });
      }

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
  }, [tryRefreshToken]);

  const login = useCallback(async (email: string, password: string) => {
    const normalizedEmail = email.trim().toLowerCase();
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    const res = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: normalizedEmail, password }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Login failed');
    }
    const data = await res.json();
    const accessToken = data.accessToken || data.access_token;
    const refreshToken = data.refreshToken || data.refresh_token;
    if (!accessToken) {
      throw new Error('Missing access token in response');
    }

    localStorage.setItem('accessToken', accessToken);
    if (refreshToken) {
      localStorage.setItem('refreshToken', refreshToken);
    }

    await fetchProfile();
  }, [fetchProfile]);

  const register = useCallback(async (email: string, password: string, name?: string) => {
    const normalizedEmail = email.trim().toLowerCase();
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    const res = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: normalizedEmail, password, name }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Registration failed');
    }
    const data = await res.json();
    const accessToken = data.accessToken || data.access_token;
    const refreshToken = data.refreshToken || data.refresh_token;
    if (!accessToken) {
      throw new Error('Missing access token in response');
    }

    localStorage.setItem('accessToken', accessToken);
    if (refreshToken) {
      localStorage.setItem('refreshToken', refreshToken);
    }

    await fetchProfile();
  }, [fetchProfile]);

  const logout = useCallback(() => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    setState({ user: null, isLoading: false, error: null });
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setState(prev => prev.isLoading ? { ...prev, isLoading: false } : prev);
    }, 5000);
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
