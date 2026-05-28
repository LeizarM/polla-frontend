import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import api from '../services/api';
import { queryClient } from '../services/queryClient';

interface User {
  id: string;
  username: string;
  full_name: string;
  phone: string;
  role: 'admin' | 'user';
  balance: number;
  status: string;
}

interface AuthStore {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (data: { username: string; password: string; full_name: string; phone: string; ci?: string }) => Promise<void>;
  logout: () => Promise<void>;
  restoreSession: () => Promise<void>;
  refreshUser: () => Promise<void>;
  updateUser: (updates: Partial<User>) => void;
  isAdmin: () => boolean;
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  user: null,
  token: null,
  isLoading: true,
  
  login: async (username, password) => {
    try {
      const response = await api.post('/api/auth/login', { username, password });
      const { access_token, user } = response?.data ?? {};
      
      if (!access_token || !user) {
        throw new Error('Respuesta inválida del servidor');
      }

      // Check if account is blocked
      if (user?.status === 'blocked') {
        throw new Error('Cuenta suspendida');
      }
      
      await AsyncStorage.setItem('token', access_token);
      set({ user, token: access_token });
      
      // Navigate based on role
      setTimeout(() => {
        if (user.role === 'admin') {
          router.replace('/admin' as any);
        } else {
          router.replace('/user' as any);
        }
      }, 100);
    } catch (error: any) {
      console.error('Login error:', error);
      
      // Transform error messages
      if (error?.response?.status === 401) {
        throw new Error('Usuario o contraseña incorrectos');
      }
      if (error?.message === 'Cuenta suspendida') {
        throw error;
      }
      if (error?.response?.status === 403) {
        throw new Error('Cuenta suspendida');
      }
      if (error?.code === 'ERR_NETWORK' || error?.message?.includes('Network')) {
        throw new Error('Sin conexión a internet');
      }
      
      throw new Error('Error al iniciar sesión. Inténtalo de nuevo');
    }
  },
  
  register: async (data) => {
    try {
      const response = await api.post('/api/signup', data);
      const { access_token, user } = response?.data ?? {};
      
      if (!access_token || !user) {
        throw new Error('Respuesta inválida del servidor');
      }
      
      await AsyncStorage.setItem('token', access_token);
      set({ user, token: access_token });
      
      // Navigate based on role (usually 'user' for new registrations)
      setTimeout(() => {
        if (user.role === 'admin') {
          router.replace('/admin' as any);
        } else {
          router.replace('/user' as any);
        }
      }, 100);
    } catch (error: any) {
      console.error('Register error:', error);
      
      // Transform error messages
      if (error?.response?.status === 409 || error?.response?.data?.message?.includes('already exists')) {
        throw new Error('Este nombre de usuario ya está en uso');
      }
      if (error?.response?.status === 422) {
        const detail = error?.response?.data?.message;
        throw new Error(detail || 'Datos inválidos. Verifica los campos');
      }
      if (error?.code === 'ERR_NETWORK' || error?.message?.includes('Network')) {
        throw new Error('Sin conexión a internet');
      }
      
      throw new Error('Error al registrar. Inténtalo de nuevo');
    }
  },
  
  logout: async () => {
    try {
      await AsyncStorage.removeItem('token');
      queryClient.clear();
      set({ user: null, token: null });
      router.replace('/auth/login' as any);
    } catch (error) {
      console.error('Logout error:', error);
    }
  },
  
  restoreSession: async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      
      if (!token) {
        set({ isLoading: false });
        return;
      }
      
      const response = await api.get('/api/auth/me');
      const user = response?.data;
      
      if (user) {
        set({ user, token, isLoading: false });
      } else {
        await AsyncStorage.removeItem('token');
        set({ isLoading: false });
      }
    } catch (error: any) {
      console.error('Session restore error:', error);
      
      // If token is invalid, clear it
      if (error?.response?.status === 401) {
        await AsyncStorage.removeItem('token');
      }
      
      set({ isLoading: false });
    }
  },
  
  refreshUser: async () => {
    try {
      const token = get().token;
      if (!token) return;
      
      const response = await api.get('/api/auth/me');
      const user = response?.data;
      
      if (user) {
        set({ user });
      }
    } catch (error) {
      console.error('Refresh user error:', error);
    }
  },
  
  updateUser: (updates) => {
    const user = get().user;
    if (user) {
      set({ user: { ...user, ...updates } });
    }
  },
  
  isAdmin: () => {
    const user = get().user;
    return user?.role === 'admin';
  },
}));
