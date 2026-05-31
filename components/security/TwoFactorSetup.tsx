/**
 * TwoFactorSetup — flujo completo de configurar 2FA TOTP desde el perfil.
 *
 *  1. Si user.totp_enabled === false → botón "Activar 2FA"
 *  2. Tap → POST /api/auth/2fa/setup → muestra QR + secret manual
 *  3. Usuario escanea con su authenticator
 *  4. Ingresa código y POST /api/auth/2fa/enable → activado ✅
 *
 *  Si ya está activo → botón "Desactivar" pide password + código TOTP.
 *
 *  Funciona web (Image source con data URL) y native (mismo).
 */
import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, Pressable, Image, ActivityIndicator, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useMutation } from '@tanstack/react-query';
import { useToast } from '../ui/Toast';
import { useTheme } from '../../contexts/ThemeContext';
import api from '../../services/api';
import * as Clipboard from 'expo-clipboard';

interface Props {
  enabled: boolean;
  onChange?: () => void;   // refetch user después de cambiar
}

export function TwoFactorSetup({ enabled, onChange }: Props) {
  const { theme } = useTheme();
  const { showToast } = useToast();
  const [step, setStep] = useState<'idle' | 'setup' | 'verify' | 'disable'>('idle');
  const [qrData, setQrData] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [disablePwd, setDisablePwd] = useState('');

  // Optimistic override: cuando activamos/desactivamos, el cambio en el
  // user state global (zustand) puede tardar 100-500ms hasta que el refresh
  // user del backend resuelva. Mientras tanto, mostramos el state esperado
  // para que la UI no quede "stale" tras un cambio exitoso.
  const [optimisticEnabled, setOptimisticEnabled] = useState<boolean | null>(null);
  const effectiveEnabled = optimisticEnabled !== null ? optimisticEnabled : enabled;

  // Cuando la prop real (del store) ya refleja el cambio, liberamos el override
  React.useEffect(() => {
    if (optimisticEnabled !== null && enabled === optimisticEnabled) {
      setOptimisticEnabled(null);
    }
  }, [enabled, optimisticEnabled]);

  const setupMut = useMutation({
    mutationFn: async () => (await api.post('/api/auth/2fa/setup'))?.data,
    onSuccess: (data) => {
      setQrData(data?.qr);
      setSecret(data?.secret);
      setStep('verify');
    },
    onError: (e: any) => {
      const msg = e?.response?.data?.message ?? 'Error al iniciar configuración 2FA';
      showToast('error', msg);
    },
  });

  const enableMut = useMutation({
    mutationFn: async () => (await api.post('/api/auth/2fa/enable', { code }))?.data,
    onSuccess: () => {
      showToast('success', '2FA activado correctamente');
      setStep('idle');
      setQrData(null); setSecret(null); setCode('');
      // Optimistic: UI ya muestra "Desactivar 2FA" inmediato; refreshUser
      // confirma con el backend en segundo plano.
      setOptimisticEnabled(true);
      onChange?.();
    },
    onError: (e: any) => {
      const msg = e?.response?.data?.message ?? 'Código incorrecto';
      showToast('error', msg);
    },
  });

  const disableMut = useMutation({
    mutationFn: async () => (await api.post('/api/auth/2fa/disable', { code, password: disablePwd }))?.data,
    onSuccess: () => {
      showToast('success', '2FA desactivado');
      setStep('idle');
      setCode(''); setDisablePwd('');
      // Optimistic: UI ya muestra "Activar 2FA" inmediato
      setOptimisticEnabled(false);
      onChange?.();
    },
    onError: (e: any) => {
      const msg = e?.response?.data?.message ?? 'Error al desactivar';
      showToast('error', msg);
    },
  });

  const copySecret = async () => {
    if (!secret) return;
    await Clipboard.setStringAsync(secret);
    showToast('success', 'Secret copiado al portapapeles');
  };

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
      <View style={styles.header}>
        <View style={[styles.iconWrap, { backgroundColor: effectiveEnabled ? '#10B98120' : theme.colors.inputBg }]}>
          <Ionicons
            name={effectiveEnabled ? 'shield-checkmark' : 'shield-outline'}
            size={20}
            color={effectiveEnabled ? '#10B981' : theme.colors.textMuted}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: theme.colors.textPrimary }]}>
            Autenticación de 2 factores
          </Text>
          <Text style={[styles.subtitle, { color: theme.colors.textMuted }]}>
            {effectiveEnabled
              ? 'Activa — login requiere código de tu app'
              : 'Añade una capa extra usando Google Authenticator, Authy, 1Password, etc.'}
          </Text>
        </View>
      </View>

      {/* ── Estado IDLE ──────────────────────────────────────────────── */}
      {step === 'idle' && !effectiveEnabled && (
        <Pressable
          style={[styles.btn, { backgroundColor: '#10B981' }]}
          onPress={() => setupMut.mutate()}
          disabled={setupMut.isPending}
        >
          {setupMut.isPending
            ? <ActivityIndicator color="#fff" size="small" />
            : <>
                <Ionicons name="add-circle" size={16} color="#fff" />
                <Text style={styles.btnText}>Activar 2FA</Text>
              </>
          }
        </Pressable>
      )}

      {step === 'idle' && effectiveEnabled && (
        <Pressable
          style={[styles.btn, { backgroundColor: '#EF4444' }]}
          onPress={() => setStep('disable')}
        >
          <Ionicons name="close-circle" size={16} color="#fff" />
          <Text style={styles.btnText}>Desactivar 2FA</Text>
        </Pressable>
      )}

      {/* ── Estado VERIFY (mostrando QR + input código) ──────────────── */}
      {step === 'verify' && qrData && (
        <View style={styles.verifyArea}>
          <Text style={[styles.smallTitle, { color: theme.colors.textPrimary }]}>
            1. Escanea el QR
          </Text>
          <View style={styles.qrWrap}>
            <Image
              source={{ uri: qrData }}
              style={{ width: 200, height: 200 }}
              resizeMode="contain"
            />
          </View>

          {secret && (
            <Pressable onPress={copySecret} style={[styles.secretRow, { backgroundColor: theme.colors.inputBg, borderColor: theme.colors.border }]}>
              <Text style={[styles.secretLabel, { color: theme.colors.textMuted }]}>O ingrésalo manual:</Text>
              <Text style={[styles.secretValue, { color: theme.colors.textPrimary }]} selectable numberOfLines={1}>
                {secret}
              </Text>
              <Ionicons name="copy-outline" size={14} color={theme.colors.primaryLight} />
            </Pressable>
          )}

          <Text style={[styles.smallTitle, { color: theme.colors.textPrimary, marginTop: 16 }]}>
            2. Ingresa el código de 6 dígitos
          </Text>
          <TextInput
            value={code}
            onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))}
            placeholder="123456"
            placeholderTextColor={theme.colors.textMuted}
            keyboardType="number-pad"
            maxLength={6}
            style={[styles.codeInput, { backgroundColor: theme.colors.inputBg, color: theme.colors.textPrimary, borderColor: theme.colors.border }]}
            autoFocus
          />

          <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
            <Pressable
              style={[styles.btnFlex, { backgroundColor: theme.colors.inputBg, borderColor: theme.colors.border, borderWidth: 1 }]}
              onPress={() => { setStep('idle'); setQrData(null); setCode(''); }}
            >
              <Text style={[styles.btnText, { color: theme.colors.textPrimary }]}>Cancelar</Text>
            </Pressable>
            <Pressable
              style={[styles.btnFlex, { backgroundColor: '#10B981' }]}
              onPress={() => enableMut.mutate()}
              disabled={enableMut.isPending || code.length !== 6}
            >
              {enableMut.isPending
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={styles.btnText}>Activar</Text>
              }
            </Pressable>
          </View>
        </View>
      )}

      {/* ── Estado DISABLE ──────────────────────────────────────────── */}
      {step === 'disable' && (
        <View style={styles.verifyArea}>
          <Text style={[styles.smallTitle, { color: theme.colors.textPrimary }]}>Confirma tu identidad</Text>
          <TextInput
            value={disablePwd}
            onChangeText={setDisablePwd}
            placeholder="Tu contraseña"
            placeholderTextColor={theme.colors.textMuted}
            secureTextEntry
            style={[styles.codeInput, { backgroundColor: theme.colors.inputBg, color: theme.colors.textPrimary, borderColor: theme.colors.border, textAlign: 'left', fontSize: Platform.OS === 'web' ? 16 : 14, paddingHorizontal: 12 }]}
          />
          <TextInput
            value={code}
            onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))}
            placeholder="Código TOTP (6 dígitos)"
            placeholderTextColor={theme.colors.textMuted}
            keyboardType="number-pad"
            maxLength={6}
            style={[styles.codeInput, { backgroundColor: theme.colors.inputBg, color: theme.colors.textPrimary, borderColor: theme.colors.border, marginTop: 8 }]}
          />
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
            <Pressable
              style={[styles.btnFlex, { backgroundColor: theme.colors.inputBg, borderColor: theme.colors.border, borderWidth: 1 }]}
              onPress={() => { setStep('idle'); setCode(''); setDisablePwd(''); }}
            >
              <Text style={[styles.btnText, { color: theme.colors.textPrimary }]}>Cancelar</Text>
            </Pressable>
            <Pressable
              style={[styles.btnFlex, { backgroundColor: '#EF4444' }]}
              onPress={() => disableMut.mutate()}
              disabled={disableMut.isPending || code.length !== 6 || !disablePwd}
            >
              {disableMut.isPending
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={styles.btnText}>Desactivar</Text>
              }
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: 14, borderRadius: 14, borderWidth: 1, gap: 12 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconWrap: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 14, fontFamily: 'Poppins_700Bold', letterSpacing: -0.2 },
  subtitle: { fontSize: 11, fontFamily: 'Poppins_400Regular', lineHeight: 15, marginTop: 2 },
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 10 },
  btnFlex: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 11, borderRadius: 10 },
  btnText: { color: '#fff', fontFamily: 'Poppins_700Bold', fontSize: 13 },

  verifyArea: { gap: 10 },
  smallTitle: { fontSize: 12, fontFamily: 'Poppins_700Bold', letterSpacing: 0.2 },
  qrWrap: { alignSelf: 'center', padding: 10, backgroundColor: '#fff', borderRadius: 10 },
  secretRow: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderRadius: 10, borderWidth: 1 },
  secretLabel: { fontSize: 10, fontFamily: 'Poppins_500Medium' },
  secretValue: { flex: 1, fontSize: 11, fontFamily: 'Poppins_700Bold', letterSpacing: 0.5 },
  codeInput: {
    fontSize: 22, letterSpacing: 8, textAlign: 'center', fontFamily: 'Poppins_700Bold',
    borderWidth: 1, borderRadius: 10, paddingVertical: 12,
  },
});
