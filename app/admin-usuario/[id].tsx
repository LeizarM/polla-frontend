/**
 * Admin Usuario Detail — Premium user management screen
 * Full-bleed gradient hero · glow avatar · section cards with gradient top lines · Poppins typography
 */
import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  Pressable, Platform, RefreshControl, Alert,
} from 'react-native';
import { SafeAreaView }   from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { safeGoBack }     from '../../utils/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons }       from '@expo/vector-icons';
import * as Haptics       from 'expo-haptics';
import { Badge }          from '../../components/ui/Badge';
import { Button }         from '../../components/ui/Button';
import { Input }          from '../../components/ui/Input';
import { Modal }          from '../../components/ui/Modal';
import { ConfirmDialog }  from '../../components/ui/ConfirmDialog';
import { Skeleton }       from '../../components/ui/Skeleton';
import { useToast }       from '../../components/ui/Toast';
import { useTheme }       from '../../contexts/ThemeContext';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import api from '../../services/api';

// ─── Section card with gradient top line ─────────────────────────────────────
function SectionCard({ children, icon, title, delay = 0 }: {
  children: React.ReactNode; icon: string; title: string; delay?: number;
}) {
  const { theme } = useTheme();
  return (
    <Animated.View
      entering={FadeInDown.delay(delay).duration(360).springify()}
      style={[styles.sectionCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
    >
      <LinearGradient
        colors={[theme.colors.primary, theme.colors.primaryLight, 'transparent']}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
        style={{ height: 1.5 }}
      />
      <View style={{ padding: 16 }}>
        <View style={styles.sectionHeader}>
          <View style={[styles.sectionIconWrap, { backgroundColor: theme.colors.primaryLight + '18' }]}>
            <Ionicons name={icon as any} size={16} color={theme.colors.primaryLight} />
          </View>
          <Text style={[styles.sectionTitle, { color: theme.colors.textPrimary }]}>{title}</Text>
        </View>
        {children}
      </View>
    </Animated.View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function UsuarioDetailScreen() {
  const { theme } = useTheme();
  const { id = '' }   = useLocalSearchParams<{ id: string }>();
  const queryClient   = useQueryClient();
  const toast         = useToast();

  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showStatusConfirm, setShowStatusConfirm] = useState(false);
  const [newPassword,       setNewPassword]       = useState('');
  const [confirmPassword,   setConfirmPassword]   = useState('');
  const [passwordError,     setPasswordError]     = useState('');

  const { data: user, isLoading, refetch } = useQuery({
    queryKey: ['admin-user', id],
    queryFn: async () => {
      try { const res = await api.get(`/api/admin/users/${id}`); return res?.data ?? null; }
      catch { return null; }
    },
    enabled: !!id,
  });

  const onRefresh = useCallback(() => { refetch(); }, [refetch]);

  const statusMutation = useMutation({
    mutationFn: async () => {
      const newStatus = user?.status === 'active' ? 'blocked' : 'active';
      const res = await api.patch(`/api/admin/users/${id}/status`, { status: newStatus });
      return res?.data;
    },
    onSuccess: () => {
      const action = user?.status === 'active' ? 'bloqueado' : 'activado';
      toast.showToast('success', `Usuario ${action}`);
      setShowStatusConfirm(false);
      queryClient.invalidateQueries({ queryKey: ['admin-user', id] });
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
    onError: (err: any) => { toast.showToast('error', err?.message ?? 'Error al cambiar estado'); },
  });

  const roleMutation = useMutation({
    mutationFn: async () => {
      const newRole = user?.role === 'admin' ? 'user' : 'admin';
      const res = await api.patch(`/api/admin/users/${id}/role`, { role: newRole });
      return res?.data;
    },
    onSuccess: () => {
      toast.showToast('success', `Rol cambiado a ${user?.role === 'admin' ? 'Usuario' : 'Administrador'}`);
      queryClient.invalidateQueries({ queryKey: ['admin-user', id] });
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
    onError: (err: any) => { toast.showToast('error', err?.message ?? 'Error al cambiar rol'); },
  });

  const passwordMutation = useMutation({
    mutationFn: async () => {
      if (!newPassword || newPassword.length < 6) throw new Error('Mínimo 6 caracteres');
      if (newPassword !== confirmPassword)        throw new Error('Las contraseñas no coinciden');
      const res = await api.patch(`/api/admin/users/${id}/password`, { new_password: newPassword });
      return res?.data;
    },
    onSuccess: () => {
      toast.showToast('success', 'Contraseña actualizada');
      setShowPasswordModal(false);
      setNewPassword(''); setConfirmPassword(''); setPasswordError('');
    },
    onError: (err: any) => { setPasswordError(err?.message ?? 'Error al resetear contraseña'); },
  });

  const handleHaptic = () => {
    if (Platform.OS !== 'web') Haptics.impactAsync?.(Haptics.ImpactFeedbackStyle.Light);
  };

  const initials = ((user?.full_name ?? 'U') as string)
    .split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();

  const isBlocked = user?.status === 'blocked';

  // ─── Loading state ─────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.bg }]} edges={['top']}>
        <LinearGradient
          colors={[theme.colors.primary, theme.colors.primaryLight]}
          start={{ x: 0, y: 0 }} end={{ x: 0.7, y: 1 }}
          style={styles.heroGrad}
        >
          <View style={styles.heroNav}>
            <Pressable onPress={() => safeGoBack('/admin')} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={20} color="rgba(255,255,255,0.85)" />
            </Pressable>
          </View>
          <View style={{ alignItems: 'center', paddingBottom: 28 }}>
            <Skeleton shape="circle" width={90} height={90} />
            <Skeleton width={160} height={22} style={{ marginTop: 14 }} />
            <Skeleton width={110} height={16} style={{ marginTop: 8 }} />
          </View>
        </LinearGradient>
      </SafeAreaView>
    );
  }

  // ─── Error state ───────────────────────────────────────────────────────────
  if (!user) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.bg }]} edges={['top']}>
        <LinearGradient
          colors={[theme.colors.primary, theme.colors.primaryLight]}
          start={{ x: 0, y: 0 }} end={{ x: 0.7, y: 1 }}
          style={[styles.heroGrad, { paddingBottom: 20 }]}
        >
          <View style={styles.heroNav}>
            <Pressable onPress={() => safeGoBack('/admin')} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={20} color="rgba(255,255,255,0.85)" />
            </Pressable>
          </View>
        </LinearGradient>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 }}>
          <Ionicons name="alert-circle-outline" size={60} color={theme.colors.textMuted} />
          <Text style={{ fontSize: 14, fontFamily: 'Poppins_400Regular', color: theme.colors.textSecondary }}>
            No se pudo cargar el usuario
          </Text>
          <Button title="Volver" onPress={() => safeGoBack('/admin')} variant="outline" />
        </View>
      </SafeAreaView>
    );
  }

  // ─── Main view ─────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.bg }]} edges={['top']}>

      {/* Full-bleed gradient hero */}
      <LinearGradient
        colors={[theme.colors.primary, theme.colors.primaryLight]}
        start={{ x: 0, y: 0 }} end={{ x: 0.7, y: 1.2 }}
        style={styles.heroGrad}
      >
        <Animated.View entering={FadeIn.duration(380)}>
          {/* Back nav */}
          <View style={styles.heroNav}>
            <Pressable onPress={() => { handleHaptic(); safeGoBack('/admin'); }} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={20} color="rgba(255,255,255,0.85)" />
            </Pressable>
            <Text style={styles.heroNavTitle}>Detalle de Usuario</Text>
            <View style={styles.heroNavIcon}>
              <Ionicons name="person" size={18} color={theme.colors.primaryLight} />
            </View>
          </View>

          {/* Avatar + info */}
          <View style={styles.heroContent}>
            <LinearGradient colors={[theme.colors.primary, theme.colors.primaryLight]} style={styles.avatarRingOuter}>
              <LinearGradient colors={[theme.colors.surfaceElevated, theme.colors.surface]} style={styles.avatarRingInner}>
                <Text style={[styles.avatarInitials, { color: theme.colors.primaryLight }]}>{initials}</Text>
              </LinearGradient>
            </LinearGradient>
            <Text style={styles.heroName}>{user?.full_name ?? '—'}</Text>
            <Text style={styles.heroUsername}>@{user?.username ?? '—'}</Text>
            {user?.phone ? (
              <View style={styles.phoneRow}>
                <Ionicons name="call-outline" size={13} color="rgba(255,255,255,0.55)" />
                <Text style={styles.phoneText}>{user.phone}</Text>
              </View>
            ) : null}
            <View style={styles.heroBadges}>
              <Badge status={user?.status as any ?? 'active'} />
              <Badge
                status={user?.role === 'admin' ? 'approved' : 'pending'}
                text={user?.role === 'admin' ? 'Admin' : 'Usuario'}
              />
            </View>
          </View>
        </Animated.View>
      </LinearGradient>

      {/* Scrollable content */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={false} onRefresh={onRefresh} tintColor={theme.colors.primaryLight} />
        }
      >
        {/* Estado */}
        <SectionCard icon="shield-outline" title="Estado de la Cuenta" delay={80}>
          <View style={styles.statusRow}>
            <View>
              <Text style={[styles.statusLabel, { color: theme.colors.textMuted }]}>Estado actual</Text>
              <Badge status={user?.status as any ?? 'active'} />
            </View>
          </View>
          <Button
            title={isBlocked ? 'Activar Cuenta' : 'Bloquear Cuenta'}
            icon={isBlocked ? 'checkmark-circle-outline' : 'ban-outline'}
            variant={isBlocked ? 'primary' : 'accent'}
            fullWidth
            onPress={() => { handleHaptic(); setShowStatusConfirm(true); }}
            style={{ marginTop: 14 }}
          />
        </SectionCard>

        {/* Rol */}
        <SectionCard icon="people-outline" title="Rol del Usuario" delay={160}>
          <View style={styles.statusRow}>
            <View>
              <Text style={[styles.statusLabel, { color: theme.colors.textMuted }]}>Rol actual</Text>
              <Badge
                status={user?.role === 'admin' ? 'approved' : 'pending'}
                text={user?.role === 'admin' ? 'Administrador' : 'Usuario'}
              />
            </View>
          </View>
          <Button
            title={user?.role === 'admin' ? 'Cambiar a Usuario' : 'Promover a Admin'}
            icon={user?.role === 'admin' ? 'person-outline' : 'shield-checkmark-outline'}
            variant={user?.role === 'admin' ? 'outline' : 'primary'}
            fullWidth
            loading={roleMutation.isPending}
            onPress={() => {
              handleHaptic();
              const action = user?.role === 'admin' ? 'quitar permisos de administrador' : 'dar permisos de administrador';
              if (Platform.OS === 'web') {
                if (window.confirm(`¿Seguro que deseas ${action}?`)) roleMutation.mutate();
              } else {
                Alert.alert('Cambiar Rol', `¿Seguro que deseas ${action} a este usuario?`, [
                  { text: 'Cancelar', style: 'cancel' },
                  { text: 'Confirmar', onPress: () => roleMutation.mutate() },
                ]);
              }
            }}
            style={{ marginTop: 14 }}
          />
        </SectionCard>

        {/* Contraseña */}
        <SectionCard icon="key-outline" title="Contraseña" delay={240}>
          <Text style={[styles.hintText, { color: theme.colors.textSecondary }]}>
            Restablece la contraseña del usuario. Mínimo 6 caracteres.
          </Text>
          <Button
            title="Resetear Contraseña"
            icon="lock-closed-outline"
            variant="outline"
            fullWidth
            onPress={() => {
              handleHaptic();
              setNewPassword(''); setConfirmPassword(''); setPasswordError('');
              setShowPasswordModal(true);
            }}
            style={{ marginTop: 14 }}
          />
        </SectionCard>

        <View style={{ height: 60 }} />
      </ScrollView>

      {/* Password Modal */}
      <Modal visible={showPasswordModal} onClose={() => setShowPasswordModal(false)}>
        <Text style={[styles.modalTitle, { color: theme.colors.textPrimary }]}>Resetear Contraseña</Text>
        <Text style={[styles.modalSub, { color: theme.colors.textSecondary }]}>
          Nueva contraseña para {user?.full_name ?? 'este usuario'}
        </Text>
        <Input
          label="Nueva contraseña"
          value={newPassword}
          onChangeText={(t) => { setNewPassword(t); setPasswordError(''); }}
          type="password"
          placeholder="Mínimo 6 caracteres"
          icon="lock-closed-outline"
        />
        <Input
          label="Confirmar contraseña"
          value={confirmPassword}
          onChangeText={(t) => { setConfirmPassword(t); setPasswordError(''); }}
          type="password"
          placeholder="Repite la contraseña"
          icon="lock-closed-outline"
          error={passwordError || undefined}
        />
        <View style={{ flexDirection: 'row', gap: 12, marginTop: 12 }}>
          <View style={{ flex: 1 }}>
            <Button title="Cancelar" variant="outline" onPress={() => setShowPasswordModal(false)} disabled={passwordMutation.isPending} />
          </View>
          <View style={{ flex: 1 }}>
            <Button title="Guardar" onPress={() => passwordMutation.mutate()} loading={passwordMutation.isPending} />
          </View>
        </View>
      </Modal>

      {/* Status Confirm */}
      <ConfirmDialog
        visible={showStatusConfirm}
        title={isBlocked ? 'Activar Cuenta' : 'Bloquear Cuenta'}
        message={
          isBlocked
            ? `¿Activar la cuenta de ${user?.full_name ?? 'este usuario'}?`
            : `¿Bloquear a ${user?.full_name ?? 'este usuario'}? No podrá iniciar sesión.`
        }
        confirmLabel={isBlocked ? 'Activar' : 'Bloquear'}
        onConfirm={() => statusMutation.mutate()}
        onCancel={() => setShowStatusConfirm(false)}
        loading={statusMutation.isPending}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  heroGrad: { paddingBottom: 0 },
  heroNav: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 14, paddingBottom: 8, gap: 12,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  heroNavTitle: { flex: 1, fontSize: 16, fontFamily: 'Poppins_600SemiBold', color: 'rgba(255,255,255,0.85)' },
  heroNavIcon: {
    width: 38, height: 38, borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },

  heroContent: { alignItems: 'center', paddingBottom: 26, paddingTop: 6 },
  avatarRingOuter: { padding: 3, borderRadius: 50, marginBottom: 12 },
  avatarRingInner: {
    width: 84, height: 84, borderRadius: 45,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarInitials: { fontSize: 28, fontFamily: 'Poppins_800ExtraBold' },
  heroName:     { fontSize: 20, fontFamily: 'Poppins_700Bold', color: '#fff', letterSpacing: -0.3, marginTop: 2 },
  heroUsername: { fontSize: 13, fontFamily: 'Poppins_400Regular', color: 'rgba(255,255,255,0.6)', marginTop: 2 },
  phoneRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  phoneText: { fontSize: 12, fontFamily: 'Poppins_400Regular', color: 'rgba(255,255,255,0.55)' },
  heroBadges: { flexDirection: 'row', gap: 8, marginTop: 10 },

  scrollContent: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 40 },

  sectionCard: {
    borderRadius: 18, borderWidth: 1, overflow: 'hidden',
    marginBottom: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16, shadowRadius: 10, elevation: 5,
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  sectionIconWrap: { width: 32, height: 32, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { fontSize: 15, fontFamily: 'Poppins_700Bold', letterSpacing: -0.2 },

  statusRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statusLabel: { fontSize: 11, fontFamily: 'Poppins_400Regular', marginBottom: 5 },
  hintText: { fontSize: 12, fontFamily: 'Poppins_400Regular', lineHeight: 18 },

  modalTitle: { fontSize: 18, fontFamily: 'Poppins_700Bold', marginBottom: 6 },
  modalSub:   { fontSize: 13, fontFamily: 'Poppins_400Regular', marginBottom: 14 },
});
