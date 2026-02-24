'use client';

import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

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
      const res = await fetch(`${API_URL}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      if (!res.ok) {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        return null;
      }
      const data = await res.json();
      localStorage.setItem('accessToken', data.accessToken);
      if (data.refreshToken) {
        localStorage.setItem('refreshToken', data.refreshToken);
      }
      return data.accessToken;
    } catch {
      return null;
    }
  }, []);

  const fetchProfile = useCallback(async () => {
    let token = localStorage.getItem('accessToken');
    if (!token) {
      const newToken = await tryRefreshToken();
      if (!newToken) {
        setState({ user: null, isLoading: false, error: null });
        return;
      }
      token = newToken;
    }
    try {
      const res = await fetch(`${API_URL}/api/auth/profile`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setState({ user: data, isLoading: false, error: null });
      } else if (res.status === 401) {
        // Try to refresh token on 401
        const newToken = await tryRefreshToken();
        if (!newToken) {
          setState({ user: null, isLoading: false, error: null });
          return;
        }
        const retryRes = await fetch(`${API_URL}/api/auth/profile`, {
          headers: { Authorization: `Bearer ${newToken}` },
        });
        if (retryRes.ok) {
          const data = await retryRes.json();
          setState({ user: data, isLoading: false, error: null });
        } else {
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          setState({ user: null, isLoading: false, error: null });
        }
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
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    try {
      const res = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const message = err.message || 'Login failed';
        setState(prev => ({ ...prev, isLoading: false, error: message }));
        throw new Error(message);
      }
      const data = await res.json();
      localStorage.setItem('accessToken', data.accessToken);
      localStorage.setItem('refreshToken', data.refreshToken);
      // Fetch full profile to get name and all fields
      await fetchProfile();
    } catch (e) {
      if (e instanceof Error) {
        setState(prev => ({ ...prev, isLoading: false, error: e.message }));
        throw e;
      }
      throw e;
    }
  }, [fetchProfile]);

  const register = useCallback(async (email: string, password: string, name?: string) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    try {
      const res = await fetch(`${API_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const message = err.message || 'Registration failed';
        setState(prev => ({ ...prev, isLoading: false, error: message }));
        throw new Error(message);
      }
      const data = await res.json();
      localStorage.setItem('accessToken', data.accessToken);
      localStorage.setItem('refreshToken', data.refreshToken);
      // Fetch full profile to get name and all fields
      await fetchProfile();
    } catch (e) {
      if (e instanceof Error) {
        setState(prev => ({ ...prev, isLoading: false, error: e.message }));
        throw e;
      }
      throw e;
    }
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
