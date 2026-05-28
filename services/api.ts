import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { API_BASE_URL } from '../constants/api';

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
      const token = await AsyncStorage.getItem('token');
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

// Response interceptor: handle errors globally
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error?.response?.status;
    
    // 401: Unauthorized - token expired or invalid
    if (status === 401) {
      try {
        await AsyncStorage.removeItem('token');
        // Only redirect if not already on auth pages
        const currentPath = window?.location?.pathname;
        if (currentPath && !currentPath.includes('/auth/')) {
          router.replace('/auth/login' as any);
        }
      } catch (e) {
        console.error('Error clearing token:', e);
      }
    }
    
    // Enhance error message for better UX
    if (error?.code === 'ERR_NETWORK' || error?.message === 'Network Error') {
      error.friendlyMessage = 'Sin conexión a internet';
    } else if (status === 403) {
      error.friendlyMessage = 'No tienes permisos para esta acción';
    } else if (status === 404) {
      error.friendlyMessage = 'Recurso no encontrado';
    } else if (status === 422) {
      error.friendlyMessage = error?.response?.data?.message || 'Datos inválidos';
    } else if (status === 500) {
      error.friendlyMessage = 'Error del servidor, intenta de nuevo';
    }
    
    return Promise.reject(error);
  }
);

export default api;
