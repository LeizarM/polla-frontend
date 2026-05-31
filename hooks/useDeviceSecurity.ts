/**
 * useDeviceSecurity — chequeo de hardening del dispositivo + bloqueo de capturas.
 *
 * Hace 3 cosas, solo en native (skip silencioso en web):
 *  1. Activa preventScreenCapture → en Android añade FLAG_SECURE
 *     (apps tipo TeamViewer no pueden ver la pantalla, screenshots → negro)
 *  2. Detecta root/jailbreak vía jail-monkey
 *  3. Detecta si la app está en debug o si fue modificada
 *
 * Devuelve un objeto que la UI puede usar para mostrar warning/block.
 */
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

interface DeviceSecurityState {
  isRooted: boolean;
  isJailBroken: boolean;
  isOnExternalStorage: boolean;
  hasInsecureKeyboard: boolean;
  isDebugged: boolean;
  isInDevMode: boolean;
  // Resumen: si alguno de los críticos es true, la app debería avisar.
  isCompromised: boolean;
  checked: boolean;
}

const SAFE_STATE: DeviceSecurityState = {
  isRooted: false,
  isJailBroken: false,
  isOnExternalStorage: false,
  hasInsecureKeyboard: false,
  isDebugged: false,
  isInDevMode: false,
  isCompromised: false,
  checked: true,
};

export function useDeviceSecurity(): DeviceSecurityState {
  const [state, setState] = useState<DeviceSecurityState>({
    ...SAFE_STATE,
    checked: false,
  });

  useEffect(() => {
    if (Platform.OS === 'web') {
      setState(SAFE_STATE);
      return;
    }

    (async () => {
      // ── 1. Bloquear capturas/screenshots ───────────────────────────
      try {
        const SC = await import('expo-screen-capture');
        await SC.preventScreenCaptureAsync();
      } catch {/* lib no instalada → skip */}

      // ── 2. Detectar root / jailbreak ───────────────────────────────
      let jailMonkey: any = null;
      try {
        jailMonkey = require('jail-monkey').default ?? require('jail-monkey');
      } catch {/* no disponible en dev/web */}

      const isRooted              = jailMonkey?.isJailBroken?.() ?? false;
      const isJailBroken          = isRooted;
      const isOnExternalStorage   = jailMonkey?.isOnExternalStorage?.() ?? false;
      const hasInsecureKeyboard   = jailMonkey?.trustFall?.() ?? false;
      const isDebugged            = jailMonkey?.isDebuggedMode?.() ?? false;
      const isInDevMode           = jailMonkey?.isDevelopmentSettingsMode?.() ?? false;

      // Compromised = condiciones realmente peligrosas
      const isCompromised = isRooted || isJailBroken || isOnExternalStorage;

      setState({
        isRooted,
        isJailBroken,
        isOnExternalStorage,
        hasInsecureKeyboard,
        isDebugged,
        isInDevMode,
        isCompromised,
        checked: true,
      });
    })();
  }, []);

  return state;
}
