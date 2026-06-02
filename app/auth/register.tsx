/**
 * Register — Premium dark auth screen
 * Split-screen desktop · Animated orbs · Glass card · Haptic feedback · Password strength
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
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
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
import { Logo }     from '../../components/ui/Logo';
import { useAuthStore } from '../../store/authStore';
import { safeGoBack }   from '../../utils/navigation';
import { API_BASE_URL } from '../../constants/api';

// ─── Animated background orbs ────────────────────────────────────────────────
function AnimatedOrbs() {
  const orb1 = useSharedValue(0.09);
  const orb2 = useSharedValue(0.07);
  useEffect(() => {
    orb1.value = withRepeat(withTiming(0.19, { duration: 4200 }), -1, true);
    orb2.value = withDelay(2000, withRepeat(withTiming(0.14, { duration: 5100 }), -1, true));
  }, []);
  const s1 = useAnimatedStyle(() => ({ opacity: orb1.value }));
  const s2 = useAnimatedStyle(() => ({ opacity: orb2.value }));
  return (
    <>
      <Animated.View pointerEvents="none" style={[{
        position: 'absolute', width: 380, height: 380,
        top: -120, right: -90, borderRadius: 190, backgroundColor: '#7C3AED',
      }, s1]} />
      <Animated.View pointerEvents="none" style={[{
        position: 'absolute', width: 320, height: 320,
        bottom: -80, left: -60, borderRadius: 160, backgroundColor: '#1D4ED8',
      }, s2]} />
      <View pointerEvents="none" style={{
        position: 'absolute', width: 160, height: 160,
        top: '45%', left: '30%', borderRadius: 80,
        backgroundColor: '#0EA5E9', opacity: 0.04,
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
            <Logo size={size * 0.6} glow />
          )}
        </LinearGradient>
      </LinearGradient>
    </View>
  );
}

// ─── Section divider label ────────────────────────────────────────────────────
function SectionLabel({ label }: { label: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8, marginBottom: 14 }}>
      <View style={{ flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.06)' }} />
      <Text style={{
        fontSize: 10, letterSpacing: 1.4, textTransform: 'uppercase',
        color: 'rgba(148,163,184,0.45)', marginHorizontal: 12,
        fontFamily: 'Poppins_500Medium',
      }}>
        {label}
      </Text>
      <View style={{ flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.06)' }} />
    </View>
  );
}

// ─── Desktop hero panel ───────────────────────────────────────────────────────
function HeroPanel({ logoUrl }: { logoUrl: string | null }) {
  return (
    <View style={{
      flex: 1, justifyContent: 'center', alignItems: 'flex-start',
      paddingHorizontal: 56, paddingVertical: 40,
      borderRightWidth: 1, borderRightColor: 'rgba(255,255,255,0.06)',
    }}>
      <View style={{ marginBottom: 28 }}>
        <LogoBadge logoUrl={logoUrl} size={110} />
      </View>
      <Text style={{
        fontSize: 38, fontFamily: 'Poppins_800ExtraBold', color: '#FFFFFF',
        letterSpacing: -1.0, lineHeight: 46, marginBottom: 14,
      }}>
        {'Únete al\nMundial 2026'}
      </Text>
      <Text style={{
        fontSize: 15, fontFamily: 'Poppins_400Regular',
        color: 'rgba(148,163,184,0.7)', lineHeight: 25, maxWidth: 360, marginBottom: 36,
      }}>
        Crea tu cuenta gratis, arma tu quiniela y competí contra amigos
        para ganar premios con tus predicciones.
      </Text>
      {([
        { icon: '⚡', label: 'Registro en menos de 1 minuto' },
        { icon: '🔒', label: 'Cuenta segura y privada' },
        { icon: '🌍', label: 'Compite desde cualquier lugar' },
        { icon: '🎁', label: 'Sin costo para unirte' },
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

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function RegisterScreen() {
  const [username,        setUsername]        = useState('');
  const [fullName,        setFullName]        = useState('');
  const [phone,           setPhone]           = useState('');
  const [ci,              setCi]              = useState('');
  const [password,        setPassword]        = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading,         setLoading]         = useState(false);
  const [logoUrl,         setLogoUrl]         = useState<string | null>(null);

  const { register }  = useAuthStore();
  const { showToast } = useToast();
  const { width }     = useWindowDimensions();
  const isDesktop     = Platform.OS === 'web' && width >= 1024;

  // Input chain refs
  const fullNameRef = useRef<any>(null);
  const phoneRef    = useRef<any>(null);
  const ciRef       = useRef<any>(null);
  const passwordRef = useRef<any>(null);
  const confirmRef  = useRef<any>(null);

  useEffect(() => {
    (async () => {
      try {
        const base = (API_BASE_URL ?? '').replace(/\/$/, '');
        const res  = await fetch(`${base}/api/settings`);
        if (res.ok) {
          const data = await res.json();
          if (data?.logo_url) setLogoUrl(data.logo_url);
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

  // ── Password strength ─────────────────────────────────────────────────────
  const getStrength = () => {
    if (!password) return null;
    if (password.length < 6)  return { label: 'Débil',  pct: '33%',  color: '#EF4444' };
    if (password.length < 10) return { label: 'Media',  pct: '66%',  color: '#F59E0B' };
    return                            { label: 'Fuerte', pct: '100%', color: '#10B981' };
  };
  const strength = getStrength();

  // ── Validation ────────────────────────────────────────────────────────────
  const validateForm = (): boolean => {
    if (!username?.trim())            { haptic('warning'); showToast('error', 'El usuario es requerido');                          return false; }
    if (username.length < 4)          { haptic('warning'); showToast('error', 'Mínimo 4 caracteres para el usuario');              return false; }
    if (username.includes(' '))       { haptic('warning'); showToast('error', 'El usuario no puede contener espacios');            return false; }
    if (!fullName?.trim())            { haptic('warning'); showToast('error', 'El nombre completo es requerido');                  return false; }
    if (!phone?.trim())               { haptic('warning'); showToast('error', 'El teléfono es requerido');                         return false; }
    if (!/^[0-9+\s-]+$/.test(phone)) { haptic('warning'); showToast('error', 'El teléfono solo puede contener números');          return false; }
    if (!ci?.trim())                  { haptic('warning'); showToast('error', 'La cédula (CI) es requerida');                      return false; }
    // Política del backend: min 8, al menos 1 letra y 1 número
    if (!password || password.length < 8)
                                      { haptic('warning'); showToast('error', 'La contraseña debe tener al menos 8 caracteres');   return false; }
    if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password))
                                      { haptic('warning'); showToast('error', 'La contraseña debe incluir letras y números');      return false; }
    if (password !== confirmPassword) { haptic('warning'); showToast('error', 'Las contraseñas no coinciden');                     return false; }
    return true;
  };

  const handleRegister = async () => {
    if (!validateForm()) return;
    setLoading(true);
    try {
      await register({
        username: username.trim(),
        password,
        full_name: fullName.trim(),
        phone: phone.trim(),
        ci: ci.trim(),
      });
      haptic('success');
      showToast('success', '¡Cuenta creada exitosamente!');
    } catch (err: any) {
      haptic('error');
      showToast('error', err?.message ?? 'Error al crear la cuenta');
    } finally {
      setLoading(false);
    }
  };

  // ── Glass card wrapper ────────────────────────────────────────────────────
  const cardDelay = isDesktop ? 0 : 80;

  const FormCard = (
    <Animated.View entering={FadeInDown.delay(cardDelay).duration(500).springify()}>
      <View style={{
        backgroundColor: 'rgba(10,16,32,0.82)',
        borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
        overflow: 'hidden',
        shadowColor: '#000', shadowOffset: { width: 0, height: 14 },
        shadowOpacity: 0.55, shadowRadius: 30, elevation: 20,
      }}>
        <LinearGradient
          colors={['#7C3AED', '#2563EB', 'transparent']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          style={{ height: 1.5 }}
        />
        <View style={{ padding: 24 }}>

          <SectionLabel label="Información personal" />

          <Input
            label="Usuario"
            value={username}
            onChangeText={setUsername}
            placeholder="Elige un usuario único"
            icon="at-outline"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="next"
            onSubmitEditing={() => fullNameRef.current?.focus()}
            error={
              username.length > 0 && username.includes(' ')
                ? 'No puede contener espacios'
                : username.length > 0 && username.length < 4
                ? 'Mínimo 4 caracteres'
                : undefined
            }
          />

          <Input
            ref={fullNameRef}
            label="Nombre Completo"
            value={fullName}
            onChangeText={setFullName}
            placeholder="Tu nombre completo"
            icon="person-outline"
            returnKeyType="next"
            onSubmitEditing={() => phoneRef.current?.focus()}
          />

          <Input
            ref={phoneRef}
            label="Teléfono"
            value={phone}
            onChangeText={setPhone}
            placeholder="+1 234 567 8900"
            type="phone"
            icon="call-outline"
            returnKeyType="next"
            onSubmitEditing={() => ciRef.current?.focus()}
          />

          <Input
            ref={ciRef}
            label="CI / Cédula"
            value={ci}
            onChangeText={setCi}
            placeholder="Ej: 12345678"
            icon="card-outline"
            type="number"
            returnKeyType="next"
            onSubmitEditing={() => passwordRef.current?.focus()}
          />

          <SectionLabel label="Seguridad" />

          <Input
            ref={passwordRef}
            label="Contraseña"
            value={password}
            onChangeText={setPassword}
            placeholder="Mínimo 8 caracteres, con letras y números"
            type="password"
            icon="lock-closed-outline"
            returnKeyType="next"
            onSubmitEditing={() => confirmRef.current?.focus()}
          />

          {password.length > 0 && strength && (
            <View style={{ marginTop: -10, marginBottom: 14 }}>
              <View style={{
                height: 4, backgroundColor: 'rgba(255,255,255,0.07)',
                borderRadius: 2, overflow: 'hidden',
              }}>
                <View style={{
                  height: '100%', width: strength.pct as any,
                  backgroundColor: strength.color, borderRadius: 2,
                }} />
              </View>
              <Text style={{
                fontSize: 10, color: strength.color,
                fontFamily: 'Poppins_500Medium', marginTop: 4,
              }}>
                Contraseña {strength.label}
              </Text>
            </View>
          )}

          <Input
            ref={confirmRef}
            label="Confirmar Contraseña"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder="Repite tu contraseña"
            type="password"
            icon="lock-open-outline"
            returnKeyType="done"
            onSubmitEditing={handleRegister}
            error={
              confirmPassword.length > 0 && password !== confirmPassword
                ? 'Las contraseñas no coinciden'
                : undefined
            }
          />

          {confirmPassword.length > 0 && password === confirmPassword && (
            <View style={{
              flexDirection: 'row', alignItems: 'center',
              gap: 6, marginTop: -10, marginBottom: 14,
            }}>
              <Ionicons name="checkmark-circle" size={15} color="#10B981" />
              <Text style={{ fontSize: 11, color: '#10B981', fontFamily: 'Poppins_500Medium' }}>
                Las contraseñas coinciden
              </Text>
            </View>
          )}

          <View style={{ marginTop: 8, marginBottom: 4 }}>
            <Button
              title="Crear Cuenta" onPress={handleRegister}
              variant="primary" size="lg" fullWidth
              loading={loading} disabled={loading}
              icon="person-add-outline" iconPosition="right"
            />
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 18 }}>
            <View style={{ flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.07)' }} />
            <Text style={{
              fontSize: 12, color: 'rgba(148,163,184,0.5)',
              marginHorizontal: 12, fontFamily: 'Poppins_400Regular',
            }}>
              ¿Ya tienes cuenta?
            </Text>
            <View style={{ flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.07)' }} />
          </View>

          <Pressable
            onPress={() => safeGoBack('/auth/login')}
            style={{ alignItems: 'center', paddingVertical: 4 }}
          >
            <Text style={{
              fontSize: 14, color: 'rgba(148,163,184,0.75)',
              fontFamily: 'Poppins_400Regular', textAlign: 'center',
            }}>
              ¿Ya tienes cuenta?{'  '}
              <Text style={{ color: '#60A5FA', fontFamily: 'Poppins_600SemiBold' }}>
                Inicia sesión →
              </Text>
            </Text>
          </Pressable>
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
          <HeroPanel logoUrl={logoUrl} />
          <ScrollView
            style={{ width: 540, alignSelf: 'stretch' }}
            contentContainerStyle={{ paddingHorizontal: 40, paddingVertical: 48 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {FormCard}
            <Animated.View entering={FadeIn.delay(350)} style={{ marginTop: 18, alignItems: 'center' }}>
              <Text style={{ fontSize: 11, color: 'rgba(100,116,139,0.45)', fontFamily: 'Poppins_400Regular' }}>
                v1.0 · Mundial 2026
              </Text>
            </Animated.View>
          </ScrollView>
        </View>
      ) : (
        /* ── Mobile: single-column ──────────────────────────────────────── */
        <SafeAreaView style={{ flex: 1 }}>
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          >
            <ScrollView
              contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 20, paddingBottom: 40 }}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {/* Page header */}
              <Animated.View
                entering={FadeIn.duration(380)}
                style={{ flexDirection: 'row', alignItems: 'center', paddingTop: 16, marginBottom: 28 }}
              >
                <Pressable
                  onPress={() => safeGoBack('/auth/login')}
                  style={{
                    width: 42, height: 42, borderRadius: 13,
                    backgroundColor: 'rgba(255,255,255,0.07)',
                    borderWidth: 1, borderColor: 'rgba(255,255,255,0.09)',
                    alignItems: 'center', justifyContent: 'center', marginRight: 14,
                  }}
                >
                  <Ionicons name="arrow-back" size={20} color="rgba(255,255,255,0.8)" />
                </Pressable>
                <View style={{ flex: 1 }}>
                  <Text style={{
                    fontSize: 24, color: '#FFFFFF',
                    fontFamily: 'Poppins_800ExtraBold', letterSpacing: -0.6,
                  }}>
                    Crear Cuenta
                  </Text>
                  <Text style={{
                    fontSize: 13, color: 'rgba(148,163,184,0.65)',
                    fontFamily: 'Poppins_400Regular', marginTop: 1,
                  }}>
                    Completa los datos para empezar
                  </Text>
                </View>
              </Animated.View>

              {FormCard}

              <Animated.View entering={FadeIn.delay(350)} style={{ marginTop: 22, alignItems: 'center' }}>
                <Text style={{ fontSize: 11, color: 'rgba(100,116,139,0.45)', fontFamily: 'Poppins_400Regular' }}>
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
