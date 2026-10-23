import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import React, { type ReactNode, useEffect } from 'react';
import api from '../lib/api';
import type { User } from '../types';

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  clientPortalLogin: (data: ClientPortalLoginData) => Promise<void>;
  clientPortalClaim: (data: ClientPortalClaimData) => Promise<void>;
  clientPortalRecover: (data: ClientPortalClaimData) => Promise<void>;
  clientPortalRegister: (data: ClientPortalRegisterData) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  setTokens: (accessToken: string, refreshToken: string) => void;
  updateProfile: (data: Partial<User>) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  startAutoRefresh: (intervalMs?: number) => void;
  stopAutoRefresh: () => void;
  autoRefreshInterval: ReturnType<typeof setInterval> | null;
}

interface RegisterData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  dni: string;
  phone?: string;
  birthDate?: string;
  role?: string;
}

interface ClientPortalLoginData {
  dni: string;
  password: string;
}

interface ClientPortalClaimData {
  dni: string;
  phone?: string;
  email?: string;
  password: string;
}

interface ClientPortalRegisterData {
  dni: string;
  firstName: string;
  lastName: string;
  phone: string;
  email?: string;
  password: string;
}

interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,
      autoRefreshInterval: null,
      
      setTokens: (accessToken, refreshToken) => {
        localStorage.setItem('accessToken', accessToken);
        localStorage.setItem('refreshToken', refreshToken);
        set({ accessToken, refreshToken, isAuthenticated: true });
      },
      
      login: async (email, password) => {
        set({ isLoading: true });
        try {
          const response = await api.post<AuthResponse>('/auth/login', { email, password });
          const { user, accessToken, refreshToken } = response.data;
          get().setTokens(accessToken, refreshToken);
          set({ user, isLoading: false });
          // Start auto-refresh after login (10s para reflejar cambios de permisos/rol rápidamente)
          get().startAutoRefresh(10_000);
        } catch (error) {
          set({ isLoading: false });
          throw error;
        }
      },
      
      register: async (data) => {
        set({ isLoading: true });
        try {
          const response = await api.post<AuthResponse>('/auth/register', data);
          const { user, accessToken, refreshToken } = response.data;
          get().setTokens(accessToken, refreshToken);
          set({ user, isLoading: false });
          get().startAutoRefresh(10_000);
        } catch (error) {
          set({ isLoading: false });
          throw error;
        }
      },

      // ===== Portal de clientes (/users) =====

      clientPortalLogin: async (data) => {
        set({ isLoading: true });
        try {
          const response = await api.post<AuthResponse>('/client-portal/login', data);
          const { user, accessToken, refreshToken } = response.data;
          get().setTokens(accessToken, refreshToken);
          set({ user, isLoading: false });
          get().startAutoRefresh(10_000);
        } catch (error) {
          set({ isLoading: false });
          throw error;
        }
      },

      clientPortalClaim: async (data) => {
        set({ isLoading: true });
        try {
          const response = await api.post<AuthResponse>('/client-portal/claim', data);
          const { user, accessToken, refreshToken } = response.data;
          get().setTokens(accessToken, refreshToken);
          set({ user, isLoading: false });
          get().startAutoRefresh(10_000);
        } catch (error) {
          set({ isLoading: false });
          throw error;
        }
      },

      clientPortalRecover: async (data) => {
        set({ isLoading: true });
        try {
          const response = await api.post<AuthResponse>('/client-portal/recover-password', data);
          const { user, accessToken, refreshToken } = response.data;
          get().setTokens(accessToken, refreshToken);
          set({ user, isLoading: false });
          get().startAutoRefresh(10_000);
        } catch (error) {
          set({ isLoading: false });
          throw error;
        }
      },

      clientPortalRegister: async (data) => {
        set({ isLoading: true });
        try {
          const response = await api.post<AuthResponse>('/client-portal/register', data);
          const { user, accessToken, refreshToken } = response.data;
          get().setTokens(accessToken, refreshToken);
          set({ user, isLoading: false });
          get().startAutoRefresh(10_000);
        } catch (error) {
          set({ isLoading: false });
          throw error;
        }
      },
      
      logout: () => {
        get().stopAutoRefresh();
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        set({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false, autoRefreshInterval: null });
      },
      
      refreshUser: async () => {
        const token = localStorage.getItem('accessToken');
        if (!token) return;
        
        try {
          const response = await api.get<User>('/auth/me');
          set({ user: response.data });
        } catch (error: any) {
          // Solo cerrar sesión si el token ya no es válido (401/403).
          // Errores transitorios (500/503, timeout, red) NO deben desloguear:
          // el interceptor de api.ts ya reintentará y renovará el token.
          const status = error?.response?.status;
          if (status === 401 || status === 403) {
            get().logout();
          }
          // En otro caso, mantener la sesión y el usuario actual.
        }
      },
      
      updateProfile: async (data) => {
        try {
          const response = await api.put<User>('/auth/me', data);
          set({ user: response.data });
        } catch (error) {
          throw error;
        }
      },
      
      changePassword: async (currentPassword, newPassword) => {
        try {
          await api.put('/auth/me/password', { currentPassword, newPassword });
        } catch (error) {
          throw error;
        }
      },
      
      startAutoRefresh: (intervalMs = 3000) => {
        const existingInterval = get().autoRefreshInterval;
        if (existingInterval) {
          clearInterval(existingInterval);
        }
        
        const interval = setInterval(() => {
          if (get().isAuthenticated) {
            get().refreshUser();
          }
        }, intervalMs);
        
        set({ autoRefreshInterval: interval });
      },
      
      stopAutoRefresh: () => {
        const interval = get().autoRefreshInterval;
        if (interval) {
          clearInterval(interval);
          set({ autoRefreshInterval: null });
        }
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const { isAuthenticated, startAutoRefresh, stopAutoRefresh } = useAuthStore();
  
  useEffect(() => {
    if (isAuthenticated) {
      startAutoRefresh(10_000);
    } else {
      stopAutoRefresh();
    }
    
    return () => stopAutoRefresh();
  }, [isAuthenticated, startAutoRefresh, stopAutoRefresh]);
  
  return <React.Fragment>{children}</React.Fragment>;
};