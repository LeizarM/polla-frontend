/**
 * Admin Perfil — Premium profile screen
 * Gradient header · glow avatar · icon info rows · ZoomIn palette grid · gradient logout
 */
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  Alert, Platform, Pressable,
} from 'react-native';
import { SafeAreaView }   from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage       from '@react-native-async-storage/async-storage';
import { router }         from 'expo-router';
import { Ionicons }       from '@expo/vector-icons';
import { Input }          from '../../components/ui/Input';
import { Button }         from '../../components/ui/Button';
import { useToast }       from '../../components/ui/Toast';
import { PressableScale } from '../../components/ui/PressableScale';
import { TwoFactorSetup } from '../../components/security/TwoFactorSetup';
import { useAuthStore }   from '../../store/authStore';
import { queryClient }    from '../../services/queryClient';
import { useTheme }       from '../../contexts/ThemeContext';
import Animated, { FadeInDown, FadeIn, ZoomIn } from 'react-native-reanimated';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import api from '../../services/api';

// ─── InfoRow ──────────────────────────────────────────────────────────────────
function InfoRow({
  icon, label, value, color, last,
}: { icon: string; label: string; value: string; color?: string; last?: boolean }) {
  const { theme } = useTheme();
  return (
    <View style={[
      styles.infoRow,
      !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border },
    ]}>
      <View style={[styles.infoIconWrap, { backgroundColor: (color ?? theme.colors.primaryLight) + '16' }]}>
        <Ionicons name={icon as any} size={16} color={color ?? theme.colors.primaryLight} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.infoLabel, { color: theme.colors.textMuted }]}>{label}</Text>
        <Text style={[styles.infoValue, { color: theme.colors.textPrimary }]}>{value || '—'}</Text>
      </View>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function PerfilScreen() {
  const { user, updateUser, refreshUser } = useAuthStore();
  const { showToast }                     = useToast();
  const { theme, paletteId, setPaletteId, palettes } = useTheme();
  const { isDesktop }                     = useBreakpoint();

  const [editing,  setEditing]  = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [formData, setFormData] = useState({
    full_name: user?.full_name ?? '',
    phone:     user?.phone     ?? '',
    username:  user?.username  ?? '',
    ci:        (user as any)?.ci ?? '',
  });

  const hasChanges =
    formData.full_name !== (user?.full_name ?? '') ||
    formData.phone     !== (user?.phone     ?? '') ||
    formData.username  !== (user?.username  ?? '') ||
    formData.ci        !== ((user as any)?.ci ?? '');

  const handleSave = async () => {
    if (!hasChanges) return;
    setLoading(true);
    try {
      const response = await api.patch('/api/users/me', formData);
      const updated  = response?.data;
      if (updated) {
        updateUser(updated);
        // Invalida queries que dependen del user (admin/usuarios, /auth/me, etc.)
        queryClient.invalidateQueries();
        showToast('success', 'Perfil actualizado correctamente');
        setEditing(false);
      }
    } catch (err: any) {
      showToast('error', err?.friendlyMessage || 'Error al actualizar perfil');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setFormData({
      full_name: user?.full_name ?? '',
      phone:     user?.phone     ?? '',
      username:  user?.username  ?? '',
      ci:        (user as any)?.ci ?? '',
    });
    setEditing(false);
  };

  const handleLogout = () => {
    if (Platform.OS === 'web') {
      if (window.confirm('¿Cerrar sesión?')) doLogout();
    } else {
      Alert.alert('Cerrar Sesión', '¿Estás seguro que deseas salir?', [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Salir', style: 'destructive', onPress: doLogout },
      ]);
    }
  };

  const doLogout = async () => {
    try {
      await AsyncStorage.clear();
      queryClient.clear();
      useAuthStore.setState({ user: null, token: null });
      router.replace('/auth/login' as any);
    } catch {}
  };

  const initials = (user?.full_name ?? 'A')
    .split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.bg }]} edges={['top']}>

      {/* Gradient header */}
      <LinearGradient
        colors={[theme.colors.primary, theme.colors.primaryLight]}
        start={{ x: 0, y: 0 }} end={{ x: 0.7, y: 1 }}
        style={styles.headerGrad}
      >
        <Animated.View entering={FadeIn.duration(380)} style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Mi Perfil</Text>
            <Text style={styles.headerSub}>Administrador del sistema</Text>
          </View>
          {!editing && (
            <Pressable onPress={() => setEditing(true)} style={styles.editBtn}>
              <Ionicons name="create-outline" size={18} color="rgba(255,255,255,0.85)" />
            </Pressable>
          )}
          <View style={styles.headerIcon}>
            <Ionicons name="shield-checkmark" size={20} color="#FFD700" />
          </View>
        </Animated.View>
      </LinearGradient>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          { paddingBottom: 40 },
          isDesktop && { maxWidth: 680, alignSelf: 'center' as any, width: '100%' },
        ]}
      >

        {/* Avatar + name */}
        <Animated.View entering={FadeInDown.delay(60).duration(400)} style={styles.avatarSection}>
          <LinearGradient
            colors={[theme.colors.primary, theme.colors.primaryLight]}
            style={styles.avatarRingOuter}
          >
            <LinearGradient
              colors={[theme.colors.surfaceElevated, theme.colors.surface]}
              style={styles.avatarRingInner}
            >
              <Text style={[styles.avatarInitials, { color: theme.colors.primaryLight }]}>{initials}</Text>
            </LinearGradient>
          </LinearGradient>
          <Text style={[styles.avatarName, { color: theme.colors.textPrimary }]}>{user?.full_name ?? '—'}</Text>
          <Text style={[styles.avatarHandle, { color: theme.colors.textSecondary }]}>@{user?.username ?? '—'}</Text>
          <View style={[styles.roleBadge, { backgroundColor: theme.colors.primaryLight + '18', borderColor: theme.colors.primaryLight + '40' }]}>
            <Ionicons name="shield-checkmark-outline" size={12} color={theme.colors.primaryLight} />
            <Text style={[styles.roleText, { color: theme.colors.primaryLight }]}>Administrador</Text>
          </View>
        </Animated.View>

        {/* Info / Edit card */}
        {editing ? (
          <Animated.View
            entering={FadeInDown.delay(120).duration(400)}
            style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
          >
            <LinearGradient
              colors={[theme.colors.primary, theme.colors.primaryLight, 'transparent']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={{ height: 1.5 }}
            />
            <View style={{ padding: 16, gap: 4 }}>
              <Input
                label="Nombre de usuario"
                value={formData.username}
                onChangeText={(v) => setFormData({ ...formData, username: v })}
                placeholder="Tu nombre de usuario"
                autoCapitalize="none"
              />
              <Input
                label="Nombre completo"
                value={formData.full_name}
                onChangeText={(v) => setFormData({ ...formData, full_name: v })}
                placeholder="Tu nombre completo"
              />
              <Input
                label="Cédula (CI)"
                value={formData.ci}
                onChangeText={(v) => setFormData({ ...formData, ci: v })}
                placeholder="Ej: 12345678"
                type="number"
              />
              <Input
                label="Teléfono"
                value={formData.phone}
                onChangeText={(v) => setFormData({ ...formData, phone: v })}
                placeholder="Tu número de teléfono"
                type="phone"
              />
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
                <Button title="Cancelar" variant="outline" size="md" onPress={handleCancel} style={{ flex: 1 }} />
                <Button title="Guardar" variant="primary" size="md" onPress={handleSave} loading={loading} disabled={!hasChanges} style={{ flex: 1 }} />
              </View>
            </View>
          </Animated.View>
        ) : (
          <Animated.View
            entering={FadeInDown.delay(120).duration(400)}
            style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
          >
            <LinearGradient
              colors={[theme.colors.primary, theme.colors.primaryLight, 'transparent']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={{ height: 1.5 }}
            />
            <InfoRow icon="person-outline"            label="Usuario"        value={`@${user?.username ?? '—'}`} />
            <InfoRow icon="text-outline"              label="Nombre"         value={user?.full_name ?? '—'} />
            <InfoRow icon="card-outline"              label="Cédula (CI)"    value={(user as any)?.ci || 'Sin registrar'} />
            <InfoRow icon="call-outline"              label="Teléfono"       value={user?.phone ?? '—'} />
            <InfoRow icon="shield-checkmark-outline"  label="Rol"            value="Administrador" color={theme.colors.primaryLight} />
            <InfoRow icon="checkmark-circle-outline"  label="Estado"         value="Activo"        color="#10B981" last />
          </Animated.View>
        )}

        {/* 2FA Setup */}
        <Animated.View
          entering={FadeInDown.delay(180).duration(400)}
          style={{ paddingHorizontal: 20, marginTop: 14 }}
        >
          <TwoFactorSetup
            enabled={!!(user as any)?.totp_enabled}
            onChange={() => { refreshUser(); }}
          />
        </Animated.View>

        {/* Color Palette */}
        <Animated.View
          entering={FadeInDown.delay(200).duration(400)}
          style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
        >
          <LinearGradient
            colors={[theme.colors.primary, theme.colors.primaryLight, 'transparent']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={{ height: 1.5 }}
          />
          <View style={{ padding: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <View style={[styles.sectionIconWrap, { backgroundColor: theme.colors.primaryLight + '18' }]}>
                <Ionicons name="color-palette-outline" size={17} color={theme.colors.primaryLight} />
              </View>
              <Text style={[styles.sectionTitle, { color: theme.colors.textPrimary }]}>Paleta de Colores</Text>
            </View>
            <Text style={[styles.sectionSub, { color: theme.colors.textSecondary }]}>
              Personaliza los colores de la app para todos los usuarios
            </Text>
            <View style={styles.paletteGrid}>
              {palettes?.map?.((p, idx) => {
                const isActive = paletteId === p.id;
                return (
                  <Animated.View key={p.id} entering={ZoomIn.delay(idx * 55).duration(280).springify()}
                    style={{ width: isDesktop ? '22%' as any : '47%' as any }}
                  >
                    <PressableScale
                      haptic="light"
                      scale={0.95}
                      onPress={() => { setPaletteId(p.id); showToast('success', `Paleta "${p.name}" aplicada`); }}
                      style={[
                        styles.paletteOption,
                        { backgroundColor: theme.colors.surfaceElevated, borderColor: theme.colors.border },
                        isActive && {
                          borderColor: p.colors.primaryLight,
                          borderWidth: 2,
                          // Subtle glow ring when active (premium touch)
                          shadowColor: p.colors.primaryLight,
                          shadowOffset: { width: 0, height: 0 },
                          shadowOpacity: 0.35,
                          shadowRadius: 10,
                          elevation: 6,
                        },
                      ]}
                    >
                      <View style={{ flexDirection: 'row', gap: 5, marginBottom: 5 }}>
                        <View style={[styles.paletteCircle, { backgroundColor: p.colors.primary }]} />
                        <View style={[styles.paletteCircle, { backgroundColor: p.colors.accent }]} />
                        <View style={[styles.paletteCircle, { backgroundColor: p.colors.primaryLight }]} />
                      </View>
                      <Text style={{ fontSize: 18, marginBottom: 2 }}>{p.emoji}</Text>
                      <Text style={[styles.paletteName, { color: isActive ? p.colors.primaryLight : theme.colors.textPrimary }]}>
                        {p.name}
                      </Text>
                      {isActive && (
                        <Ionicons name="checkmark-circle" size={16} color={p.colors.primaryLight} style={{ marginTop: 2 }} />
                      )}
                    </PressableScale>
                  </Animated.View>
                );
              })}
            </View>
          </View>
        </Animated.View>

        {/* Logout */}
        <Animated.View entering={FadeInDown.delay(280).duration(400)} style={{ paddingHorizontal: 20, paddingTop: 6 }}>
          <PressableScale onPress={handleLogout} haptic="heavy" style={styles.logoutWrap}>
            <LinearGradient
              colors={['#EF4444', '#DC2626']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={styles.logoutGrad}
            >
              <Ionicons name="log-out-outline" size={20} color="#fff" />
              <Text style={styles.logoutText}>Cerrar Sesión</Text>
            </LinearGradient>
          </PressableScale>
        </Animated.View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  headerGrad: { paddingBottom: 24 },
  headerRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 14, gap: 12,
  },
  headerTitle: { fontSize: 22, fontFamily: 'Poppins_800ExtraBold', color: '#fff', letterSpacing: -0.4 },
  headerSub:   { fontSize: 12, fontFamily: 'Poppins_400Regular', color: 'rgba(255,255,255,0.6)', marginTop: 1 },
  editBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerIcon: {
    width: 42, height: 42, borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },

  avatarSection: { alignItems: 'center', paddingVertical: 28 },
  avatarRingOuter: { padding: 3, borderRadius: 52, marginBottom: 14 },
  avatarRingInner: {
    width: 90, height: 90, borderRadius: 48,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarInitials: { fontSize: 32, fontFamily: 'Poppins_800ExtraBold' },
  avatarName:     { fontSize: 20, fontFamily: 'Poppins_700Bold', letterSpacing: -0.3 },
  avatarHandle:   { fontSize: 13, fontFamily: 'Poppins_400Regular', marginTop: 2 },
  roleBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 5,
    borderRadius: 20, borderWidth: 1, marginTop: 10,
  },
  roleText: { fontSize: 12, fontFamily: 'Poppins_600SemiBold' },

  card: {
    marginHorizontal: 20, marginBottom: 14,
    borderRadius: 18, borderWidth: 1, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18, shadowRadius: 12, elevation: 5,
  },

  infoRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 13, paddingHorizontal: 16 },
  infoIconWrap: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  infoLabel: { fontSize: 11, fontFamily: 'Poppins_400Regular', marginBottom: 1 },
  infoValue: { fontSize: 14, fontFamily: 'Poppins_600SemiBold' },

  sectionIconWrap: { width: 32, height: 32, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { fontSize: 16, fontFamily: 'Poppins_700Bold', letterSpacing: -0.2 },
  sectionSub:   { fontSize: 12, fontFamily: 'Poppins_400Regular', marginBottom: 14, marginTop: 2 },

  paletteGrid:   { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  paletteOption: { borderRadius: 14, padding: 12, alignItems: 'center', borderWidth: 1, flex: 1 },
  paletteCircle: { width: 18, height: 18, borderRadius: 9 },
  paletteName:   { fontSize: 11, fontFamily: 'Poppins_600SemiBold', textAlign: 'center' },

  logoutWrap: {
    borderRadius: 16, overflow: 'hidden',
    shadowColor: '#EF4444', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 10, elevation: 6,
  },
  logoutGrad: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 15, gap: 10,
  },
  logoutText: { fontSize: 15, fontFamily: 'Poppins_700Bold', color: '#fff' },
});
