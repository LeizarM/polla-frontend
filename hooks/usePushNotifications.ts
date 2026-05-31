import { useEffect, useRef, useCallback } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import api from '../services/api';

// Detect Expo Go — push notifications are not supported there (SDK 53+)
const isExpoGo = Constants.appOwnership === 'expo';

// Only set handler if not in Expo Go and not web
if (!isExpoGo && Platform.OS !== 'web') {
  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
  } catch {
    // Silently ignore if native module is unavailable
  }
}

async function registerForPushNotificationsAsync(): Promise<string | null> {
  if (Platform.OS === 'web') return null;
  if (isExpoGo) return null;  // Not supported in Expo Go SDK 53+
  if (!Device.isDevice) return null;

  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Default',
        importance: Notifications.AndroidImportance.MAX,
        sound: 'default',
        vibrationPattern: [0, 250, 250, 250],
      });
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') return null;

    const projectId =
      Constants?.expoConfig?.extra?.eas?.projectId ??
      (Constants as any)?.easConfig?.projectId;

    if (!projectId) return null;

    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
    return tokenData?.data ?? null;
  } catch (error) {
    console.log('Push notifications unavailable:', error);
    return null;
  }
}

// Cache global del último token enviado al backend para esta sesión.
// Evita re-enviar el MISMO token en cada navegación / re-render del hook.
let __lastSentPushToken: string | null = null;

export function usePushNotifications(isAuthenticated: boolean) {
  const router = useRouter();
  const notificationListener = useRef<Notifications.Subscription | null>(null);
  const responseListener = useRef<Notifications.Subscription | null>(null);
  // Mantenemos router en ref para usarlo dentro de los listeners SIN
  // hacer que el useEffect se re-ejecute cuando router identity cambia.
  const routerRef = useRef(router);
  routerRef.current = router;

  useEffect(() => {
    if (!isAuthenticated || Platform.OS === 'web' || isExpoGo) return;

    // 1) Registrar token (solo si NO fue ya enviado este token en esta sesión)
    (async () => {
      try {
        const token = await registerForPushNotificationsAsync();
        if (!token) return;
        if (token === __lastSentPushToken) {
          // Mismo token que la última vez → NO re-enviar al backend
          return;
        }
        await api.post('/api/push-tokens', { token, device_type: Platform.OS });
        __lastSentPushToken = token;
        console.log('Push token registered:', token);
      } catch (error) {
        console.log('Failed to register push token:', error);
      }
    })();

    // 2) Listeners de notificaciones — usan routerRef para no triggear re-runs
    try {
      notificationListener.current = Notifications.addNotificationReceivedListener(
        (notification) => {
          console.log('Notification received:', notification?.request?.content?.title);
        }
      );

      responseListener.current = Notifications.addNotificationResponseReceivedListener(
        (response) => {
          const data = response?.notification?.request?.content?.data;
          if (data?.type === 'matchday_reminder' && data?.matchday_id) {
            routerRef.current.push(`/quiniela/${data.matchday_id}` as any);
          } else if (data?.type === 'final_bet_reminder' && data?.tournament_id) {
            routerRef.current.push(`/tournament/${data.tournament_id}` as any);
          }
        }
      );
    } catch {
      // Silently ignore if native module unavailable
    }

    return () => {
      notificationListener.current?.remove();
      responseListener.current?.remove();
    };
    // SOLO depende de isAuthenticated. router cambia en cada navegación y
    // antes hacía que TODO el efecto (incluido registrar token) se ejecutara
    // de nuevo → spam al backend.
  }, [isAuthenticated]);
}
