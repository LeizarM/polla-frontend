import { create } from 'zustand';
import { router } from 'expo-router';
import api from '../services/api';
import { queryClient } from '../services/queryClient';
import { secureStore } from '../services/secureStorage';

interface User {
  id: string;
  username: string;
  full_name: string;
  phone: string;
  role: 'admin' | 'user';
  balance: number;
  status: string;
  totp_enabled?: boolean;
  ci?: string | null;
  fcm_token?: string | null;
}

interface AuthStore {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (username: string, password: string, totpCode?: string) => Promise<{ requires_2fa?: boolean }>;
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
  
  login: async (username, password, totpCode) => {
    try {
      const payload: any = { username, password };
      if (totpCode) payload.totp_code = totpCode;
      const response = await api.post('/api/auth/login', payload);
      const data = response?.data ?? {};

      // Si el backend pide 2FA → devolvemos signal, la UI muestra el input TOTP
      if (data?.requires_2fa) {
        return { requires_2fa: true };
      }

      const { access_token, user } = data;
      if (!access_token || !user) {
        throw new Error('Respuesta inválida del servidor');
      }
      if (user?.status === 'blocked') {
        throw new Error('Cuenta suspendida');
      }

      await secureStore.set('token', access_token);
      set({ user, token: access_token });
      queryClient.invalidateQueries();

      setTimeout(() => {
        if (user.role === 'admin') {
          router.replace('/admin' as any);
        } else {
          router.replace('/user' as any);
        }
      }, 100);
      return {};
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
      
      await secureStore.set('token', access_token);
      set({ user, token: access_token });

      // Invalida queries del usuario anterior (si lo había)
      queryClient.invalidateQueries();

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

      const status = error?.response?.status;
      const backendMsg = error?.response?.data?.message;

      // 409 = conflicto REAL de usuario en uso (backend solo usa 409 para eso)
      if (status === 409) {
        throw new Error(backendMsg || 'Este nombre de usuario ya está en uso');
      }
      // 400/422 = validación (CI faltante, password débil, etc.) → mostrar el
      // mensaje REAL del backend, no asumir "usuario en uso".
      if (status === 400 || status === 422) {
        throw new Error(backendMsg || 'Datos inválidos. Verifica los campos');
      }
      if (error?.code === 'ERR_NETWORK' || error?.message?.includes('Network')) {
        throw new Error('Sin conexión a internet');
      }
      
      throw new Error('Error al registrar. Inténtalo de nuevo');
    }
  },
  
  logout: async () => {
    try {
      await secureStore.remove('token');
      queryClient.clear();
      set({ user: null, token: null });
      router.replace('/auth/login' as any);
    } catch (error) {
      console.error('Logout error:', error);
    }
  },
  
  restoreSession: async () => {
    try {
      const token = await secureStore.get('token');

      if (!token) {
        set({ user: null, token: null, isLoading: false });
        return;
      }

      const response = await api.get('/api/auth/me');
      const user = response?.data;

      if (user) {
        set({ user, token, isLoading: false });
      } else {
        await secureStore.remove('token');
        set({ user: null, token: null, isLoading: false });
      }
    } catch (error: any) {
      console.error('Session restore error:', error);

      // Si el SERVER rechazó el token (401 expirado/inválido, 403 cuenta
      // bloqueada/revocada) limpiamos la sesión por completo. Solo conservamos
      // el token ante un error de RED (server caído / sin internet) para no
      // desloguear por un corte temporal.
      const status = error?.response?.status;
      if (status === 401 || status === 403) {
        await secureStore.remove('token');
        set({ user: null, token: null });
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
