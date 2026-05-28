import { router } from 'expo-router';
import { Platform } from 'react-native';

/**
 * Navega hacia atrás de forma segura.
 * En web, `router.back()` no hace nada si no hay historial previo (ej: URL directa,
 * refresh). En ese caso redirige a `fallback`.
 */
export function safeGoBack(fallback = '/user') {
  // En web, el historial del browser es la fuente de verdad
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.history.length <= 1) {
    router.replace(fallback as any);
    return;
  }
  if (router.canGoBack()) {
    router.back();
  } else {
    router.replace(fallback as any);
  }
}
