import axios from 'axios';
import { router } from 'expo-router';
import { API_BASE_URL } from '../constants/api';
import { queryClient } from './queryClient';
import { secureStore } from './secureStorage';
import { useAuthStore } from '../store/authStore';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
  transformRequest: [
    (data) => {
      if (data && typeof data === 'object') {
        return JSON.stringify(data);
      }
      return data;
    },
  ],
});

// Request interceptor: add auth token
api.interceptors.request.use(
  async (config) => {
    try {
      const token = await secureStore.get('token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (error) {
      console.error('Error getting token:', error);
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ─── Auto-invalidate React Query cache después de mutaciones ────────────
// Cualquier POST/PATCH/PUT/DELETE exitoso invalida TODAS las queries.
// Como queryClient tiene staleTime: 0, las pantallas activas re-fetchean
// inmediatamente y las listas se actualizan al instante.
// Esto resuelve "creo algo y no lo veo hasta refrescar".
api.interceptors.response.use(
  (response) => {
    const method = response?.config?.method?.toLowerCase();
    if (method && ['post', 'patch', 'put', 'delete'].includes(method)) {
      // Fire-and-forget — no bloquea la respuesta para el código que la espera.
      // Pequeño delay para que el componente que disparó la mutación procese
      // el response ANTES de que el refetch dispare un re-render.
      setTimeout(() => {
        try { queryClient.invalidateQueries(); } catch {/* */}
      }, 50);
    }
    return response;
  },
  async (error) => Promise.reject(error),
);

// Response interceptor: handle errors globally
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error?.response?.status;
    
    // 401: token expirado/inválido/revocado. Si había sesión activa, la
    // cerramos COMPLETA (token + estado en memoria + cache + redirect a login).
    // OJO: en native `window.location` es undefined → antes el redirect nunca
    // corría en la APK y el usuario quedaba atrapado con la sesión muerta.
    if (status === 401) {
      try {
        const hadSession = useAuthStore.getState().token != null;
        if (hadSession) {
          // logout() borra el token (secureStore), resetea el store, limpia
          // queries y navega a login — funciona en web Y en native.
          await useAuthStore.getState().logout();
        } else {
          // 401 sin sesión (ej. login con credenciales malas): solo limpiamos
          // un token residual, sin redirect (la pantalla de login muestra el error).
          await secureStore.remove('token');
        }
      } catch (e) {
        console.error('Error clearing session:', e);
      }
    }
    
    // Enhance error message for better UX
    const serverMsg = error?.response?.data?.message;
    if (error?.code === 'ERR_NETWORK' || error?.message === 'Network Error') {
      error.friendlyMessage = 'Sin conexión a internet';
    } else if (status === 401 && typeof serverMsg === 'string' && serverMsg.includes('autenticación reciente')) {
      // FreshAuthGuard rechazó: token muy viejo para acción crítica
      error.friendlyMessage = 'Por seguridad, vuelve a iniciar sesión para realizar esta acción';
    } else if (status === 403) {
      error.friendlyMessage = serverMsg || 'No tienes permisos para esta acción';
    } else if (status === 404) {
      error.friendlyMessage = 'Recurso no encontrado';
    } else if (status === 422) {
      error.friendlyMessage = serverMsg || 'Datos inválidos';
    } else if (status === 500) {
      error.friendlyMessage = 'Error del servidor, intenta de nuevo';
    }
    
    return Promise.reject(error);
  }
);

export default api;
