/**
 * useWebPush — registra el Service Worker, pide permiso de notificaciones,
 * obtiene la PushSubscription y la manda al backend para guardarla.
 *
 * Solo se ejecuta en web. En native es no-op (allí ya está usePushNotifications).
 */
import { useEffect } from 'react';
import { Platform } from 'react-native';
import api from '../services/api';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export function useWebPush(isAuthenticated: boolean) {
  useEffect(() => {
    if (!isAuthenticated) return;
    if (Platform.OS !== 'web') return;
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.log('[push] Browser sin soporte de Web Push');
      return;
    }

    (async () => {
      try {
        // 1. Registrar SW
        const reg = await navigator.serviceWorker.register('/sw.js');

        // 2. Pedir permiso
        const perm = await Notification.requestPermission();
        if (perm !== 'granted') {
          console.log('[push] Usuario rechazó permisos');
          return;
        }

        // 3. Suscripción existente?
        let sub = await reg.pushManager.getSubscription();

        if (!sub) {
          // 4. Pedir VAPID pública al backend
          const keyRes = await api.get('/api/push/vapid-public-key');
          const pubKey = keyRes?.data?.publicKey;
          if (!pubKey) {
            console.log('[push] Backend no tiene VAPID configurada');
            return;
          }
          sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(pubKey),
          });
        }

        // 5. Mandar suscripción al backend (mismo endpoint que native)
        await api.post('/api/push-tokens', {
          token: JSON.stringify(sub),
          device_type: 'web',
        });
        console.log('[push] Web Push registrado');
      } catch (e) {
        console.log('[push] Error:', e);
      }
    })();
  }, [isAuthenticated]);
}
