/**
 * Login — Premium centered auth screen
 *
 *  Layout responsivo único (sin split):
 *   - Móvil:     Logo XL + título + card centrada vertical
 *   - Tablet:    Logo XL + título + card más ancha (max 480px)
 *   - Desktop:   Logo XXL + título grande + card max 460px, aún centrado
 *
 *  Sin chips de features (recortadas/feas). Sin hairline visible en card.
 *  Card "glass" con borde sutil + sombra profunda + halo brand.
 *  Fondo oscuro con 3 orbs animados (azul/morado/cyan), pulso suave.
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
  ZoomIn,
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
  const orb1 = useSharedValue(0.18);
  const orb2 = useSharedValue(0.12);
  const orb3 = useSharedValue(0.05);
  useEffect(() => {
    orb1.value = withRepeat(withTiming(0.28, { duration: 3800 }), -1, true);
    orb2.value = withDelay(1500, withRepeat(withTiming(0.20, { duration: 4500 }), -1, true));
    orb3.value = withDelay(2200, withRepeat(withTiming(0.09, { duration: 5200 }), -1, true));
  }, []);
  const s1 = useAnimatedStyle(() => ({ opacity: orb1.value }));
  const s2 = useAnimatedStyle(() => ({ opacity: orb2.value }));
  const s3 = useAnimatedStyle(() => ({ opacity: orb3.value }));
  return (
    <>
      {/* Azul arriba-izquierda */}
      <Animated.View pointerEvents="none" style={[{
        position: 'absolute', width: 520, height: 520,
        top: -180, left: -180, borderRadius: 260, backgroundColor: '#1D4ED8',
      }, s1]} />
      {/* Morado abajo-derecha */}
      <Animated.View pointerEvents="none" style={[{
        position: 'absolute', width: 460, height: 460,
        bottom: -160, right: -160, borderRadius: 230, backgroundColor: '#7C3AED',
      }, s2]} />
      {/* Cyan centro (sutil) */}
      <Animated.View pointerEvents="none" style={[{
        position: 'absolute', width: 280, height: 280,
        top: '40%', left: '38%', borderRadius: 140,
        backgroundColor: '#0EA5E9',
      }, s3]} />
    </>
  );
}

// ─── Logo with halo + double ring ─────────────────────────────────────────────
function LogoBadge({ logoUrl, size = 140 }: { logoUrl: string | null; size?: number }) {
  // Animated subtle pulse on the halo
  const halo = useSharedValue(0.55);
  useEffect(() => {
    halo.value = withRepeat(withTiming(0.85, { duration: 2200 }), -1, true);
  }, []);
  const haloStyle = useAnimatedStyle(() => ({ shadowOpacity: halo.value }));

  const r = Math.round(size * 0.28);
  return (
    <Animated.View style={[{
      shadowColor: '#3B82F6',
      shadowOffset: { width: 0, height: 0 },
      shadowRadius: 44,
      elevation: 18,
    }, haloStyle]}>
      <LinearGradient
        colors={['#1D4ED8', '#7C3AED', '#0EA5E9']}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={{ width: size, height: size, borderRadius: r, padding: 3 }}
      >
        <LinearGradient
          colors={['#0A1020', '#111827']}
          style={{ flex: 1, borderRadius: r - 3, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}
        >
          {/* Subtle inner top highlight */}
          <LinearGradient
            colors={['rgba(255,255,255,0.08)', 'transparent']}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, height: size * 0.45 }}
            pointerEvents="none"
          />
          {logoUrl ? (
            <Image
              source={{ uri: logoUrl }}
              style={{ width: size * 0.66, height: size * 0.66, borderRadius: r * 0.6 }}
              contentFit="contain"
              transition={300}
            />
          ) : (
            <Text style={{ fontSize: size * 0.48 }}>{LOGO_EMOJI}</Text>
          )}
        </LinearGradient>
      </LinearGradient>
    </Animated.View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function LoginScreen() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);
  const [appTitle, setAppTitle] = useState(DEFAULT_TITLE);
  const [logoUrl,  setLogoUrl]  = useState<string | null>(null);

  const { login }     = useAuthStore();
  const { showToast } = useToast();
  const { width, height } = useWindowDimensions();
  const passwordRef   = useRef<any>(null);

  // Tamaños responsivos (móvil, tablet, desktop, ultra-wide)
  const isPhone   = width < 600;
  const isTablet  = width >= 600 && width < 1024;
  const isDesktop = width >= 1024;

  const logoSize  = isPhone ? 120 : isTablet ? 160 : 190;
  const titleSize = isPhone ? 26  : isTablet ? 36  : 42;
  const subtitleSize = isPhone ? 13 : isTablet ? 15 : 16;
  const cardMaxWidth = isPhone ? '100%' : isTablet ? 460 : 480;

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

  const [totpCode, setTotpCode] = useState('');
  const [needsTotp, setNeedsTotp] = useState(false);

  const handleLogin = async () => {
    if (!username?.trim() || !password?.trim()) {
      haptic('warning');
      showToast('error', 'Completa todos los campos');
      return;
    }
    if (needsTotp && !totpCode.trim()) {
      haptic('warning');
      showToast('error', 'Ingresa el código de tu app authenticator');
      return;
    }
    setLoading(true);
    try {
      const result = await login(username.trim(), password, totpCode.trim() || undefined);
      if (result?.requires_2fa) {
        // El backend pide el TOTP. Mostramos input adicional sin perder credenciales.
        setNeedsTotp(true);
        haptic('warning');
        showToast('info', 'Ingresa el código de 6 dígitos de tu app authenticator');
      } else {
        haptic('success');
        // Login OK; reset state
        setNeedsTotp(false);
        setTotpCode('');
      }
    } catch (err: any) {
      haptic('error');
      const msg = err?.message ?? 'Error al iniciar sesión';
      // Si el código TOTP era incorrecto, el backend manda "Código 2FA incorrecto"
      if (msg.includes('2FA') || msg.includes('código')) {
        setTotpCode('');
      }
      showToast('error',
        msg.includes('suspendida') || msg.includes('blocked')
          ? 'Cuenta suspendida. Contacta al administrador'
          : msg,
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient
      colors={['#020818', '#060D22', '#020610']}
      locations={[0, 0.5, 1]}
      style={{ flex: 1 }}
    >
      <AnimatedOrbs />

      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            contentContainerStyle={{
              flexGrow: 1,
              justifyContent: 'center',
              alignItems: 'center',
              paddingHorizontal: isPhone ? 20 : 32,
              paddingVertical: 32,
              minHeight: height,
            }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* ── Bloque centrado con max-width para no estirarse infinito ── */}
            <View style={{ width: '100%', maxWidth: cardMaxWidth, alignSelf: 'center' }}>

              {/* Logo + Título */}
              <Animated.View
                entering={FadeInDown.duration(550).springify()}
                style={{ alignItems: 'center', marginBottom: isPhone ? 28 : 36 }}
              >
                <Animated.View entering={ZoomIn.duration(700).springify()} style={{ marginBottom: 22 }}>
                  <LogoBadge logoUrl={logoUrl} size={logoSize} />
                </Animated.View>

                <Text style={{
                  fontSize: titleSize,
                  fontFamily: 'Poppins_800ExtraBold',
                  color: '#FFFFFF',
                  letterSpacing: -0.8,
                  textAlign: 'center',
                  marginBottom: 8,
                  lineHeight: titleSize * 1.15,
                }} numberOfLines={2}>
                  {appTitle}
                </Text>

                <Text style={{
                  fontSize: subtitleSize,
                  color: 'rgba(148,163,184,0.75)',
                  fontFamily: 'Poppins_400Regular',
                  textAlign: 'center',
                  letterSpacing: 0.2,
                  maxWidth: 340,
                  lineHeight: subtitleSize * 1.5,
                }}>
                  Inicia sesión para continuar al panel
                </Text>
              </Animated.View>

              {/* ── Card del formulario ─────────────────────────────────── */}
              <Animated.View entering={FadeInDown.delay(120).duration(500).springify()}>
                <View style={{
                  backgroundColor: 'rgba(10,16,32,0.78)',
                  borderRadius: 24,
                  borderWidth: 1,
                  borderColor: 'rgba(96,165,250,0.15)',
                  overflow: 'hidden',
                  // Halo brand sutil alrededor de la card
                  shadowColor: '#1D4ED8',
                  shadowOffset: { width: 0, height: 20 },
                  shadowOpacity: 0.35,
                  shadowRadius: 40,
                  elevation: 20,
                }}>
                  {/* Highlight superior interno (premium glass) */}
                  <LinearGradient
                    colors={['rgba(255,255,255,0.06)', 'transparent']}
                    style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 80 }}
                    pointerEvents="none"
                  />

                  <View style={{ padding: isPhone ? 24 : 32 }}>
                    <Text style={{
                      fontSize: 20,
                      fontFamily: 'Poppins_700Bold',
                      color: '#FFFFFF',
                      letterSpacing: -0.4,
                      marginBottom: 4,
                    }}>
                      Bienvenido de vuelta
                    </Text>
                    <Text style={{
                      fontSize: 12.5,
                      fontFamily: 'Poppins_400Regular',
                      color: 'rgba(148,163,184,0.6)',
                      marginBottom: 22,
                    }}>
                      Ingresa tus credenciales
                    </Text>

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
                      returnKeyType={needsTotp ? 'next' : 'done'}
                      onSubmitEditing={handleLogin}
                    />

                    {/* Campo TOTP — solo aparece después del primer intento si el user
                        tiene 2FA activado */}
                    {needsTotp && (
                      <Input
                        label="Código 2FA"
                        value={totpCode}
                        onChangeText={(v) => setTotpCode(v.replace(/\D/g, '').slice(0, 6))}
                        placeholder="123456"
                        icon="key-outline"
                        keyboardType="number-pad"
                        returnKeyType="done"
                        onSubmitEditing={handleLogin}
                        maxLength={6}
                        autoFocus
                      />
                    )}

                    <View style={{ marginTop: 12 }}>
                      <Button
                        title="Iniciar Sesión"
                        onPress={handleLogin}
                        variant="primary"
                        size="lg"
                        fullWidth
                        loading={loading}
                        disabled={loading}
                        icon="arrow-forward"
                        iconPosition="right"
                      />
                    </View>

                    <View style={{
                      flexDirection: 'row', alignItems: 'center',
                      marginVertical: 22,
                    }}>
                      <View style={{ flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.07)' }} />
                      <Text style={{
                        fontSize: 11,
                        color: 'rgba(148,163,184,0.5)',
                        marginHorizontal: 14,
                        fontFamily: 'Poppins_500Medium',
                        letterSpacing: 0.5,
                        textTransform: 'uppercase',
                      }}>
                        ¿Primera vez?
                      </Text>
                      <View style={{ flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.07)' }} />
                    </View>

                    <Link href="/auth/register" asChild>
                      <Pressable style={{
                        alignItems: 'center',
                        paddingVertical: 8,
                      }}>
                        <Text style={{
                          fontSize: 13.5,
                          color: 'rgba(148,163,184,0.85)',
                          fontFamily: 'Poppins_400Regular',
                          textAlign: 'center',
                        }}>
                          ¿No tienes cuenta?{'  '}
                          <Text style={{
                            color: '#60A5FA',
                            fontFamily: 'Poppins_700Bold',
                          }}>
                            Regístrate →
                          </Text>
                        </Text>
                      </Pressable>
                    </Link>
                  </View>
                </View>
              </Animated.View>

              {/* ── Footer version ──────────────────────────────────────── */}
              <Animated.View
                entering={FadeIn.delay(380)}
                style={{ marginTop: 22, alignItems: 'center' }}
              >
                <Text style={{
                  fontSize: 10.5,
                  color: 'rgba(100,116,139,0.45)',
                  fontFamily: 'Poppins_500Medium',
                  letterSpacing: 0.8,
                }}>
                  v1.0 · MUNDIAL 2026
                </Text>
              </Animated.View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}
