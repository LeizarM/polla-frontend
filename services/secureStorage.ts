/**
 * secureStorage — wrapper unificado para credenciales sensibles (JWT).
 *
 *   - iOS:      Keychain Services (encriptado por OS)
 *   - Android:  EncryptedSharedPreferences vía AES (encriptado por OS)
 *   - Web:      localStorage (no encriptado — único disponible, HTTPS-only)
 *
 * NUNCA pongas JWT en AsyncStorage en producción: en Android sin encriptar
 * cualquier app con permisos de root puede leerlo.
 *
 * Uso:
 *   import { secureStore } from '../services/secureStorage';
 *   await secureStore.set('token', jwt);
 *   const t = await secureStore.get('token');
 *   await secureStore.remove('token');
 */
import { Platform } from 'react-native';

let SecureStore: any = null;
if (Platform.OS !== 'web') {
  // Solo importamos en native — expo-secure-store no funciona en web
  try {
    SecureStore = require('expo-secure-store');
  } catch {/* fallback abajo */}
}

export const secureStore = {
  async set(key: string, value: string): Promise<void> {
    if (Platform.OS === 'web') {
      try { window.localStorage.setItem(key, value); } catch {/* */}
      return;
    }
    if (SecureStore) {
      await SecureStore.setItemAsync(key, value, {
        keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      });
    }
  },

  async get(key: string): Promise<string | null> {
    if (Platform.OS === 'web') {
      try { return window.localStorage.getItem(key); } catch { return null; }
    }
    if (SecureStore) {
      return SecureStore.getItemAsync(key);
    }
    return null;
  },

  async remove(key: string): Promise<void> {
    if (Platform.OS === 'web') {
      try { window.localStorage.removeItem(key); } catch {/* */}
      return;
    }
    if (SecureStore) {
      await SecureStore.deleteItemAsync(key);
    }
  },
};
