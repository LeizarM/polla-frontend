import '../global.css'; // ← NativeWind: MUST be first import
import { useEffect } from 'react';
import { Slot, useRouter, useSegments, SplashScreen } from 'expo-router';
import { QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSpring,
} from 'react-native-reanimated';
import {
  useFonts,
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
  Poppins_800ExtraBold,
} from '@expo-google-fonts/poppins';
import { useAuthStore } from '../store/authStore';
import { ToastProvider } from '../components/ui/Toast';
import { OfflineIndicator } from '../components/ui/OfflineIndicator';
import { PWAInstallPrompt } from '../components/ui/PWAInstallPrompt';
import { Logo } from '../components/ui/Logo';
import { DeviceSecurityGate } from '../components/security/DeviceSecurityGate';
import { queryClient } from '../services/queryClient';
import { theme, fonts } from '../constants/theme';
import { usePushNotifications } from '../hooks/usePushNotifications';
import { useWebPush } from '../hooks/useWebPush';
import { ThemeProvider } from '../contexts/ThemeContext';
import { SidebarProvider } from '../contexts/SidebarContext';
import { isAdminOnlySegment } from '../constants/route-access';

SplashScreen.preventAutoHideAsync();

function LoadingScreen() {
  const scale = useSharedValue(1);

  useEffect(() => {
    scale.value = withRepeat(
      withSpring(1.12, { damping: 2, stiffness: 80 }),
      -1,
      true,
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <LinearGradient colors={['#07091A', '#001A6E', '#07091A']} style={styles.loadingContainer}>
      {/* Decorative orbs */}
      <View style={[styles.orb, { width: 300, height: 300, top: -80, left: -80, backgroundColor: '#001A6E', opacity: 0.4 }]} />
      <View style={[styles.orb, { width: 250, height: 250, bottom: -60, right: -60, backgroundColor: '#7C3AED', opacity: 0.3 }]} />

      <Animated.View style={animatedStyle}><Logo size={92} glow /></Animated.View>
      <Text style={styles.title}>Apuestas</Text>
      <Text style={styles.titleAccent}>Mundial 2026</Text>
      <Text style={styles.tagline}>El torneo más grande te espera</Text>
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color={theme.colors.accentLight} />
      </View>
    </LinearGradient>
  );
}

interface AuthGuardProps {
  children: React.ReactNode;
  fontsLoaded: boolean;
}

function AuthGuard({ children, fontsLoaded }: AuthGuardProps) {
  const { user, isLoading, restoreSession, isAdmin } = useAuthStore();
  const segments = useSegments();
  const router = useRouter();

  usePushNotifications(!!user);
  useWebPush(!!user);

  useEffect(() => {
    restoreSession();
  }, []);

  useEffect(() => {
    if (!isLoading && fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [isLoading, fontsLoaded]);

  useEffect(() => {
    if (isLoading) return;

    const seg0 = segments?.[0];
    const inAuthGroup  = seg0 === 'auth';
    // Cubre TODOS los segmentos admin-only (admin, admin-usuario, tournament),
    // no solo '/admin'. Antes un usuario podía deep-linkear a /admin-usuario/<id>
    // o /tournament/<id> y el guard no lo bloqueaba.
    const inAdminOnly = isAdminOnlySegment(seg0);

    if (!user && !inAuthGroup) {
      router.replace('/auth/login');
    } else if (user && inAuthGroup) {
      router.replace(isAdmin() ? '/admin' : '/user');
    } else if (user && inAdminOnly && !isAdmin()) {
      // Usuario normal intentando acceder a ruta admin → fuera
      router.replace('/user');
    }
  }, [user, isLoading, segments]);

  if (isLoading || !fontsLoaded) {
    return <LoadingScreen />;
  }

  return <>{children}</>;
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
    Poppins_800ExtraBold,
  });

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <SidebarProvider>
          <ToastProvider>
            <DeviceSecurityGate>
              <AuthGuard fontsLoaded={!!fontsLoaded}>
                <StatusBar style="light" />
                <Slot />
                {/* Web-only: banner offline + sugerencia "Instalar PWA" */}
                <OfflineIndicator />
                <PWAInstallPrompt />
              </AuthGuard>
            </DeviceSecurityGate>
          </ToastProvider>
        </SidebarProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  orb: {
    position: 'absolute',
    borderRadius: 9999,
  },
  logo: {
    fontSize: 88,
    marginBottom: theme.spacing.lg,
  },
  title: {
    fontSize: 36,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -1,
    fontFamily: fonts.extrabold,
  },
  titleAccent: {
    fontSize: 36,
    fontWeight: '800',
    color: theme.colors.accentLight,
    letterSpacing: -1,
    fontFamily: fonts.extrabold,
    marginBottom: theme.spacing.sm,
  },
  tagline: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
    fontFamily: fonts.regular,
    marginTop: theme.spacing.xs,
  },
  loaderContainer: {
    marginTop: theme.spacing.xl,
  },
});
