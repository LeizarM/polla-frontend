import { Platform } from 'react-native';

/**
 * Resolución de la URL del backend.
 *
 * ── Producción ──────────────────────────────────────────────────────
 *   Establece la env var EXPO_PUBLIC_API_URL en build time (Expo la
 *   hornea en el bundle):
 *
 *     EXPO_PUBLIC_API_URL=https://app.esppapel.com:9443
 *
 *   Web (Vercel/Netlify) y APK ambos usan ese valor.
 *
 * ── Desarrollo local ────────────────────────────────────────────────
 *   - Web sin env var: derivado del host actual (localhost:3000).
 *   - Móvil/Expo Go sin env var: pon EXPO_PUBLIC_API_URL en .env apuntando
 *     a la IP de tu máquina de desarrollo (ej. http://192.168.1.20:3000).
 */
const getBaseURL = (): string => {
  // Producción / cualquier build con EXPO_PUBLIC_API_URL → la respeta
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }
  // Web en dev local: misma máquina, puerto 3000
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return `http://${window.location.hostname}:3000`;
  }
  // Fallback (móvil sin .env): nada inteligente que adivinar — pon EXPO_PUBLIC_API_URL.
  return 'http://localhost:3000';
};

export const API_BASE_URL = getBaseURL();
