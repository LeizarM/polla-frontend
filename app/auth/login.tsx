/**
 * Login — Premium dark auth screen
 * Split-screen desktop · Animated orbs · Glass card · Haptic feedback · World Cup 2026
 */
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Pressable,
  useWindowDimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Link } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withDelay,
  FadeInDown,
  FadeIn,
} from 'react-native-reanimated';
import { Input }    from '../../components/ui/Input';
import { Button }   from '../../components/ui/Button';
import { useToast } from '../../components/ui/Toast';
import { useAuthStore } from '../../store/authStore';
import { API_BASE_URL }  from '../../constants/api';

const DEFAULT_TITLE = 'Apuestas Mundial 2026';
const LOGO_EMOJI    = '⚽';

// ─── Animated background orbs ────────────────────────────────────────────────
function AnimatedOrbs() {
  const orb1 = useSharedValue(0.12);
  const orb2 = useSharedValue(0.08);
  useEffect(() => {
    orb1.value = withRepeat(withTiming(0.22, { duration: 3800 }), -1, true);
    orb2.value = withDelay(1800, withRepeat(withTiming(0.15, { duration: 4500 }), -1, true));
  }, []);
  const s1 = useAnimatedStyle(() => ({ opacity: orb1.value }));
  const s2 = useAnimatedStyle(() => ({ opacity: orb2.value }));
  return (
    <>
      <Animated.View pointerEvents="none" style={[{
        position: 'absolute', width: 420, height: 420,
        top: -140, left: -100, borderRadius: 210, backgroundColor: '#1D4ED8',
      }, s1]} />
      <Animated.View pointerEvents="none" style={[{
        position: 'absolute', width: 360, height: 360,
        bottom: -100, right: -80, borderRadius: 180, backgroundColor: '#7C3AED',
      }, s2]} />
      <View pointerEvents="none" style={{
        position: 'absolute', width: 180, height: 180,
        top: '38%', left: '35%', borderRadius: 90,
        backgroundColor: '#0EA5E9', opacity: 0.05,
      }} />
    </>
  );
}

// ─── Logo with glow ring ──────────────────────────────────────────────────────
function LogoBadge({ logoUrl, size = 100 }: { logoUrl: string | null; size?: number }) {
  const r = Math.round(size * 0.28);
  return (
    <View style={{
      shadowColor: '#2563EB', shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.7, shadowRadius: 28, elevation: 12,
    }}>
      <LinearGradient
        colors={['#1D4ED8', '#7C3AED']}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={{ width: size, height: size, borderRadius: r, padding: 2.5 }}
      >
        <LinearGradient
          colors={['#0A1020', '#111827']}
          style={{ flex: 1, borderRadius: r - 2, alignItems: 'center', justifyContent: 'center' }}
        >
          {logoUrl ? (
            <Image
              source={{ uri: logoUrl }}
              style={{ width: size * 0.64, height: size * 0.64, borderRadius: r * 0.6 }}
              contentFit="contain"
              transition={300}
            />
          ) : (
            <Text style={{ fontSize: size * 0.46 }}>{LOGO_EMOJI}</Text>
          )}
        </LinearGradient>
      </LinearGradient>
    </View>
  );
}

// ─── Desktop hero panel ───────────────────────────────────────────────────────
function HeroPanel({ appTitle, logoUrl }: { appTitle: string; logoUrl: string | null }) {
  return (
    <View style={{
      flex: 1, justifyContent: 'center', alignItems: 'flex-start',
      paddingHorizontal: 56, paddingVertical: 40,
      borderRightWidth: 1, borderRightColor: 'rgba(255,255,255,0.06)',
    }}>
      <View style={{ marginBottom: 28 }}>
        <LogoBadge logoUrl={logoUrl} size={120} />
      </View>
      <Text style={{
        fontSize: 40, fontFamily: 'Poppins_800ExtraBold', color: '#FFFFFF',
        letterSpacing: -1.2, lineHeight: 48, marginBottom: 14,
      }}>
        {appTitle}
      </Text>
      <Text style={{
        fontSize: 15, fontFamily: 'Poppins_400Regular',
        color: 'rgba(148,163,184,0.7)', lineHeight: 25, maxWidth: 380, marginBottom: 36,
      }}>
        Predice resultados, competí con amigos y ganá premios en la quiniela
        más emocionante del Mundial 2026.
      </Text>
      {([
        { icon: '🏆', label: 'Torneos grupales con amigos' },
        { icon: '⚽', label: '64 partidos del Mundial 2026' },
        { icon: '🎯', label: 'Predicciones en tiempo real' },
        { icon: '💰', label: 'Premios por aciertos' },
      ] as const).map(({ icon, label }) => (
        <View key={label} style={{
          flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10,
          backgroundColor: 'rgba(255,255,255,0.04)',
          borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
          borderRadius: 50, paddingHorizontal: 18, paddingVertical: 8,
          alignSelf: 'flex-start',
        }}>
          <Text style={{ fontSize: 16 }}>{icon}</Text>
          <Text style={{ fontSize: 13, fontFamily: 'Poppins_500Medium', color: 'rgba(203,213,225,0.8)' }}>
            {label}
          </Text>
        </View>
      ))}
    </View>
  );
}

// ─── Login form card ──────────────────────────────────────────────────────────
// ─── Screen ───────────────────────────────────────────────────────────────────
export default function LoginScreen() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);
  const [appTitle, setAppTitle] = useState(DEFAULT_TITLE);
  const [logoUrl,  setLogoUrl]  = useState<string | null>(null);

  const { login }     = useAuthStore();
  const { showToast } = useToast();
  const { width }     = useWindowDimensions();
  const isDesktop     = Platform.OS === 'web' && width >= 1024;
  const passwordRef   = useRef<any>(null);

  useEffect(() => {
    (async () => {
      try {
        const base = (API_BASE_URL ?? '').replace(/\/$/, '');
        const res  = await fetch(`${base}/api/settings`);
        if (res.ok) {
          const data = await res.json();
          if (data?.app_title) setAppTitle(data.app_title);
          if (data?.logo_url)  setLogoUrl(data.logo_url);
        }
      } catch {}
    })();
  }, []);

  const haptic = (type: 'warning' | 'error' | 'success') => {
    if (Platform.OS === 'web') return;
    const map = {
      warning: Haptics.NotificationFeedbackType.Warning,
      error:   Haptics.NotificationFeedbackType.Error,
      success: Haptics.NotificationFeedbackType.Success,
    } as const;
    Haptics.notificationAsync(map[type]).catch(() => {});
  };

  const handleLogin = async () => {
    if (!username?.trim() || !password?.trim()) {
      haptic('warning');
      showToast('error', 'Completa todos los campos');
      return;
    }
    setLoading(true);
    try {
      await login(username.trim(), password);
      haptic('success');
    } catch (err: any) {
      haptic('error');
      const msg = err?.message ?? 'Error al iniciar sesión';
      showToast('error',
        msg.includes('suspendida') || msg.includes('blocked')
          ? 'Cuenta suspendida. Contacta al administrador'
          : msg,
      );
    } finally {
      setLoading(false);
    }
  };

  const cardDelay = isDesktop ? 0 : 100;

  const FormCard = (
    <Animated.View entering={FadeInDown.delay(cardDelay).duration(500).springify()}>
      <View style={{
        backgroundColor: 'rgba(10,16,32,0.82)',
        borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
        overflow: 'hidden',
        shadowColor: '#000', shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.5, shadowRadius: 28, elevation: 18,
      }}>
        <LinearGradient
          colors={['#2563EB', '#7C3AED', 'transparent']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          style={{ height: 1.5 }}
        />
        <View style={{ padding: 28 }}>
          {isDesktop && (
            <>
              <Text style={{
                fontSize: 22, fontFamily: 'Poppins_700Bold', color: '#fff',
                letterSpacing: -0.4, marginBottom: 4,
              }}>
                Bienvenido de vuelta
              </Text>
              <Text style={{
                fontSize: 13, fontFamily: 'Poppins_400Regular',
                color: 'rgba(148,163,184,0.6)', marginBottom: 20,
              }}>
                Inicia sesión para continuar
              </Text>
            </>
          )}
          <Input
            label="Usuario"
            value={username}
            onChangeText={setUsername}
            placeholder="Tu nombre de usuario"
            icon="person-outline"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="next"
            onSubmitEditing={() => passwordRef.current?.focus()}
          />
          <Input
            label="Contraseña"
            value={password}
            onChangeText={setPassword}
            placeholder="Tu contraseña"
            type="password"
            icon="lock-closed-outline"
            returnKeyType="done"
            onSubmitEditing={handleLogin}
          />
          <View style={{ marginTop: 8, marginBottom: 4 }}>
            <Button
              title="Iniciar Sesión" onPress={handleLogin}
              variant="primary" size="lg" fullWidth
              loading={loading} disabled={loading}
              icon="arrow-forward" iconPosition="right"
            />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 20 }}>
            <View style={{ flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.07)' }} />
            <Text style={{
              fontSize: 12, color: 'rgba(148,163,184,0.5)',
              marginHorizontal: 12, fontFamily: 'Poppins_400Regular',
            }}>
              ¿Primera vez?
            </Text>
            <View style={{ flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.07)' }} />
          </View>
          <Link href="/auth/register" asChild>
            <Pressable style={{ alignItems: 'center', paddingVertical: 4 }}>
              <Text style={{
                fontSize: 14, color: 'rgba(148,163,184,0.75)',
                fontFamily: 'Poppins_400Regular', textAlign: 'center',
              }}>
                ¿No tienes cuenta?{'  '}
                <Text style={{ color: '#60A5FA', fontFamily: 'Poppins_600SemiBold' }}>
                  Regístrate →
                </Text>
              </Text>
            </Pressable>
          </Link>
        </View>
      </View>
    </Animated.View>
  );

  return (
    <LinearGradient
      colors={['#020818', '#060D22', '#030B18']}
      locations={[0, 0.5, 1]}
      style={{ flex: 1 }}
    >
      <AnimatedOrbs />

      {isDesktop ? (
        /* ── Desktop: split-screen ──────────────────────────────────────── */
        <View style={{ flex: 1, flexDirection: 'row' }}>
          <HeroPanel appTitle={appTitle} logoUrl={logoUrl} />
          <View style={{
            width: 500, justifyContent: 'center',
            paddingHorizontal: 40, paddingVertical: 40,
          }}>
            {FormCard}
            <Animated.View entering={FadeIn.delay(300)} style={{ marginTop: 18, alignItems: 'center' }}>
              <Text style={{ fontSize: 11, color: 'rgba(100,116,139,0.45)', fontFamily: 'Poppins_400Regular' }}>
                v1.0 · Mundial 2026
              </Text>
            </Animated.View>
          </View>
        </View>
      ) : (
        /* ── Mobile: single-column ──────────────────────────────────────── */
        <SafeAreaView style={{ flex: 1 }}>
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          >
            <ScrollView
              contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 20, paddingTop: 40, paddingBottom: 32 }}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {/* Logo + title */}
              <Animated.View
                entering={FadeInDown.duration(500).springify()}
                style={{ alignItems: 'center', marginBottom: 32 }}
              >
                <View style={{ marginBottom: 20 }}>
                  <LogoBadge logoUrl={logoUrl} size={100} />
                </View>
                <Text style={{
                  fontSize: 26, fontFamily: 'Poppins_800ExtraBold', color: '#FFFFFF',
                  letterSpacing: -0.8, textAlign: 'center', marginBottom: 4,
                }}>
                  {appTitle}
                </Text>
                <Text style={{
                  fontSize: 13, color: 'rgba(148,163,184,0.8)',
                  fontFamily: 'Poppins_400Regular', textAlign: 'center', letterSpacing: 0.2,
                }}>
                  Inicia sesión para continuar
                </Text>
              </Animated.View>

              {FormCard}

              <Animated.View entering={FadeIn.delay(300)} style={{ marginTop: 24, alignItems: 'center' }}>
                <Text style={{ fontSize: 11, color: 'rgba(100,116,139,0.5)', fontFamily: 'Poppins_400Regular' }}>
                  v1.0 · Mundial 2026
                </Text>
              </Animated.View>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      )}
    </LinearGradient>
  );
}
