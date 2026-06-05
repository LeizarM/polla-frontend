/**
 * Admin Dashboard — Premium redesign
 * Animated stats · gradient action cards · responsive layout
 */
import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl,
  Pressable, Alert, Platform, TouchableOpacity,
} from 'react-native';
import { LinearGradient }  from 'expo-linear-gradient';
import { SafeAreaView }    from 'react-native-safe-area-context';
import { Ionicons }        from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router }          from 'expo-router';
import { useFocusEffect }  from '@react-navigation/native';
import AsyncStorage        from '@react-native-async-storage/async-storage';
import Animated, { FadeInDown, FadeIn, ZoomIn } from 'react-native-reanimated';
import { Input }    from '../../components/ui/Input';
import { Button }   from '../../components/ui/Button';
import { Skeleton } from '../../components/ui/Skeleton';
import { Modal }    from '../../components/ui/Modal';
import { AnimatedCounter } from '../../components/ui/AnimatedCounter';
import { PressableScale }  from '../../components/ui/PressableScale';
import { useAuthStore }    from '../../store/authStore';
import { useToast }        from '../../components/ui/Toast';
import { useTheme }        from '../../contexts/ThemeContext';
import { useBreakpoint }   from '../../hooks/useBreakpoint';
import { queryClient as globalQueryClient } from '../../services/queryClient';
import { theme as staticTheme } from '../../constants/theme';
import api from '../../services/api';
import { formatMoney } from '../../utils/currency';

// ─── Stat card item ────────────────────────────────────────────────────────────

function StatItem({
  icon, value, label, color, bg, loading, badge, onPress, hint, formatter,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  value: string | number;
  label: string;
  color: string;
  bg: string;
  loading?: boolean;
  badge?: boolean;
  onPress?: () => void;
  hint?: string;
  formatter?: (n: number) => string;   // Custom formatter for numeric values
}) {
  const isNumeric = typeof value === 'number';
  const inner = (
    <View style={si.wrap}>
      <View style={[si.iconBox, { backgroundColor: bg }]}>
        <Ionicons name={icon} size={19} color={color} />
        {badge && <View style={si.dot} />}
      </View>
      {loading ? (
        <Skeleton width={38} height={18} style={{ marginVertical: 2, borderRadius: 6 }} />
      ) : isNumeric ? (
        <AnimatedCounter
          value={value as number}
          duration={900}
          formatter={formatter}
          style={[si.value, { color }]}
        />
      ) : (
        <Text style={[si.value, { color }]}>{value}</Text>
      )}
      <Text style={si.label}>{label}</Text>
      {hint ? <Text style={[si.hint, { color }]} numberOfLines={1}>{hint}</Text> : null}
    </View>
  );
  return onPress
    ? <PressableScale onPress={onPress} haptic="light">{inner}</PressableScale>
    : inner;
}

const si = StyleSheet.create({
  wrap:   { flex: 1, alignItems: 'center', gap: 5 },
  iconBox:{ width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  dot:    { position: 'absolute', top: -3, right: -3, width: 11, height: 11, borderRadius: 6, backgroundColor: '#EF4444', borderWidth: 2, borderColor: '#162540' },
  value:  { fontSize: 15, fontFamily: 'Poppins_700Bold', letterSpacing: -0.3 },
  hint:   { fontSize: 9, fontFamily: 'Poppins_600SemiBold', letterSpacing: 0.2, opacity: 0.85, textAlign: 'center', marginTop: 1 },
  label:  { fontSize: 9.5, fontFamily: 'Poppins_500Medium', color: '#64748B', textAlign: 'center', letterSpacing: 0.3 },
});

// ─── Admin action card ─────────────────────────────────────────────────────────

function AdminAction({
  icon, label, gradient, sub, route, badge, delay = 0, isDesktop,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  sub: string;
  gradient: [string, string];
  route: string;
  badge?: number;
  delay?: number;
  isDesktop?: boolean;
}) {
  return (
    <Animated.View entering={ZoomIn.delay(delay).duration(300).springify()} style={[ac.outer, isDesktop && ac.outerDesktop]}>
      <PressableScale
        onPress={() => router.push(route as any)}
        haptic="medium"
        scale={0.94}
        style={ac.pressable}
      >
        <LinearGradient
          colors={gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1.2, y: 1 }}
          style={ac.grad}
        >
          {/* Subtle inner highlight (premium glass-like top edge) */}
          <LinearGradient
            colors={['rgba(255,255,255,0.15)', 'transparent']}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 50 }}
            pointerEvents="none"
          />

          {/* Badge */}
          {(badge ?? 0) > 0 && (
            <View style={ac.badge}>
              <Text style={ac.badgeText}>{badge}</Text>
            </View>
          )}

          {/* Icon */}
          <View style={ac.iconWrap}>
            <Ionicons name={icon} size={26} color="rgba(255,255,255,0.95)" />
          </View>

          <Text style={ac.label}>{label}</Text>
          <Text style={ac.sub}>{sub}</Text>
        </LinearGradient>
      </PressableScale>
    </Animated.View>
  );
}

const ac = StyleSheet.create({
  outer:        { width: '47%', minWidth: 130, borderRadius: 18, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 14, elevation: 10 },
  outerDesktop: { width: '31%', minWidth: 160 },
  pressable:    { borderRadius: 18, overflow: 'hidden' },
  grad:         { padding: 18, minHeight: 112, justifyContent: 'flex-end', position: 'relative' },
  iconWrap:     { width: 44, height: 44, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  label:        { fontSize: 14, fontFamily: 'Poppins_700Bold', color: '#FFF', letterSpacing: -0.2 },
  sub:          { fontSize: 10, fontFamily: 'Poppins_400Regular', color: 'rgba(255,255,255,0.6)', marginTop: 2 },
  badge:        { position: 'absolute', top: 12, right: 12, backgroundColor: '#FFF', borderRadius: 9, paddingHorizontal: 6, paddingVertical: 2, minWidth: 20, alignItems: 'center' },
  badgeText:    { fontSize: 10, fontFamily: 'Poppins_700Bold', color: '#EF4444' },
});

// ─── Dashboard ────────────────────────────────────────────────────────────────

export default function AdminDashboard() {
  const { user }         = useAuthStore();
  const { showToast }    = useToast();
  const { isDesktop }    = useBreakpoint();
  const { theme }        = useTheme();
  const styles           = useMemo(() => makeStyles(theme), [theme]);
  const queryClient      = useQueryClient();
  const [refreshing, setRefreshing]   = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const doLogout = async () => {
    try {
      await AsyncStorage.clear();
      // BUG FIX SEGURIDAD: el token vive en secureStore, NO en AsyncStorage.
      // Antes este logout NO lo borraba → al reabrir la app, restoreSession lo
      // encontraba y entraba solo sin pedir credenciales. logout() del store
      // hace secureStore.remove('token') + clear queries + reset + navega.
      await useAuthStore.getState().logout();
    } catch {}
  };

  const handleLogout = () => {
    if (Platform.OS === 'web') {
      if (window.confirm('¿Cerrar sesión?')) doLogout();
    } else {
      Alert.alert('Cerrar Sesión', '¿Salir?', [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Salir', style: 'destructive', onPress: doLogout },
      ]);
    }
  };

  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useQuery({
    queryKey: ['admin-stats'],
    queryFn:  async () => {
      try {
        return (await api.get('/api/admin/stats'))?.data;
      } catch {
        return { total_users: 0, active_tournaments: 0, total_pool: 0 };
      }
    },
  });

  const { data: pendingCount, refetch: refetchPending } = useQuery({
    queryKey: ['admin-pending-enrollments'],
    queryFn:  async () => {
      try {
        const res = await api.get('/api/tournaments');
        let pending = 0;
        for (const t of (res?.data ?? [])) {
          try {
            const pr = await api.get(`/api/tournament-participants/tournament/${t?.id}`);
            pending += (pr?.data ?? []).filter((p: any) => p?.status === 'pending').length;
          } catch {}
        }
        return pending;
      } catch { return 0; }
    },
  });

  // Tickets propios del admin (también participa) → suma prize_won = Total Ganado.
  // Mismo cálculo que en el dashboard del usuario para consistencia.
  const { data: myTickets, refetch: refetchMyTickets } = useQuery({
    queryKey: ['admin-my-tickets'],
    queryFn: async () => {
      try {
        const res = await api.get('/api/tickets/me');
        return res?.data ?? [];
      } catch { return []; }
    },
  });

  const myTotalWon = useMemo(() => {
    if (!Array.isArray(myTickets)) return 0;
    return myTickets.reduce((sum: number, t: any) => sum + Number(t?.prize_won ?? 0), 0);
  }, [myTickets]);

  useFocusEffect(useCallback(() => {
    refetchStats();
    refetchPending();
    refetchMyTickets();
  }, []));

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refetchStats(), refetchPending(), refetchMyTickets()]);
    setRefreshing(false);
  };

  const ACTIONS = [
    { icon: 'trophy'       as any, label: 'Torneos',    sub: 'Crear y gestionar', gradient: ['#1e3a8a', '#1D4ED8'] as [string,string], route: '/admin/torneos',  badge: pendingCount ?? 0, delay: 0 },
    { icon: 'create'       as any, label: 'Resultados', sub: 'Ingresar marcadores',gradient: ['#7f1d1d', '#DC2626'] as [string,string], route: '/admin/partidos', delay: 60 },
    { icon: 'star'         as any, label: 'Polla Final',sub: 'Gestionar predicciones',gradient: ['#78350f', '#D97706'] as [string,string], route: '/admin/polla',   delay: 120 },
    { icon: 'people'       as any, label: 'Usuarios',   sub: 'Roles y cuentas',   gradient: ['#064e3b', '#059669'] as [string,string], route: '/admin/usuarios', delay: 180 },
    { icon: 'ticket'       as any, label: 'Apostar',    sub: 'Tus apuestas',      gradient: ['#1e1b4b', '#4F46E5'] as [string,string], route: '/admin/participar',delay: 240 },
    { icon: 'person-circle'as any, label: 'Perfil',     sub: 'Tu cuenta',         gradient: ['#312e81', '#6D28D9'] as [string,string], route: '/admin/perfil',   delay: 300 },
  ];

  return (
    <View style={styles.root}>

      {/* ── Desktop top bar ──────────────────────────────────────────────── */}
      {isDesktop && (
        <Animated.View entering={FadeIn.duration(300)} style={styles.desktopBar}>
          <View style={{ flex: 1 }}>
            <Text style={styles.desktopBarRole}>Panel Administrador</Text>
            <Text style={styles.desktopBarName}>{user?.full_name || user?.username}</Text>
          </View>
          <TouchableOpacity onPress={() => setShowSettings(true)} style={styles.iconBtn}>
            <Ionicons name="settings-outline" size={20} color={theme.colors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleLogout} style={styles.iconBtn}>
            <Ionicons name="log-out-outline" size={20} color="#EF4444" />
          </TouchableOpacity>
        </Animated.View>
      )}

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primaryLight} />
        }
      >
        {/* ── Mobile hero ──────────────────────────────────────────────── */}
        {!isDesktop && (
          <LinearGradient
            colors={[theme.colors.primary, theme.colors.primaryLight, theme.colors.bg] as [string,string,string]}
            start={{ x: 0, y: 0 }} end={{ x: 0.8, y: 1 }}
            style={styles.hero}
          >
            <View style={styles.heroOrb1} pointerEvents="none" />
            <View style={styles.heroOrb2} pointerEvents="none" />
            <SafeAreaView edges={['top']}>
              <View style={styles.heroHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.heroGreeting}>Panel Administrador</Text>
                  <Text style={styles.heroName}>{user?.full_name || user?.username}</Text>
                </View>
                <TouchableOpacity onPress={() => setShowSettings(true)} style={styles.heroIconBtn}>
                  <Ionicons name="settings-outline" size={20} color="rgba(255,255,255,0.85)" />
                </TouchableOpacity>
                <TouchableOpacity onPress={handleLogout} style={styles.heroIconBtn}>
                  <Ionicons name="log-out-outline" size={20} color="#EF4444" />
                </TouchableOpacity>
              </View>
            </SafeAreaView>
          </LinearGradient>
        )}

        {/* ── Stats card ───────────────────────────────────────────────── */}
        <Animated.View
          entering={FadeInDown.delay(80).duration(450).springify()}
          style={[styles.statsOuter, isDesktop && styles.statsOuterDesktop]}
        >
          <View style={[styles.statsCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
            <LinearGradient
              colors={[theme.colors.primaryLight, theme.colors.accent]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={{ height: 2 }}
            />
            <View style={styles.statsRow}>
              <StatItem
                icon="people" value={stats?.total_users ?? 0} label="Usuarios"
                color="#2563EB" bg="rgba(37,99,235,0.12)" loading={statsLoading}
              />
              <View style={[styles.statDiv, { backgroundColor: theme.colors.border }]} />
              <StatItem
                icon="trophy" value={stats?.active_tournaments ?? 0} label="Torneos"
                color="#059669" bg="rgba(5,150,105,0.12)" loading={statsLoading}
              />
              <View style={[styles.statDiv, { backgroundColor: theme.colors.border }]} />
              <StatItem
                icon={myTotalWon > 0 ? 'cash' : 'wallet-outline'}
                // El admin también compite: muestra SU total ganado personal,
                // igual que ven los usuarios en su dashboard.
                value={myTotalWon}
                formatter={(n) => formatMoney(n)}
                label="Total Ganado"
                color={myTotalWon > 0 ? '#10B981' : '#CA8A04'}
                bg={myTotalWon > 0 ? 'rgba(16,185,129,0.12)' : 'rgba(202,138,4,0.12)'}
                loading={statsLoading}
              />
              <View style={[styles.statDiv, { backgroundColor: theme.colors.border }]} />
              <StatItem
                icon="notifications" value={pendingCount ?? 0} label="Pendientes"
                color="#D97706" bg="rgba(217,119,6,0.12)"
                badge={(pendingCount ?? 0) > 0}
                onPress={() => router.push('/admin/torneos' as any)}
              />
            </View>
          </View>
        </Animated.View>

        {/* ── Pending alert ────────────────────────────────────────────── */}
        {(pendingCount ?? 0) > 0 && (
          <Animated.View entering={FadeInDown.delay(160).duration(400)} style={styles.alertWrap}>
            <PressableScale
              onPress={() => router.push('/admin/torneos' as any)}
              haptic="light"
              style={styles.alertCard}
            >
              <View style={styles.alertPulse} />
              <Ionicons name="notifications" size={17} color="#D97706" />
              <Text style={styles.alertText}>
                {pendingCount} solicitud{(pendingCount ?? 0) !== 1 ? 'es' : ''} de inscripción pendiente{(pendingCount ?? 0) !== 1 ? 's' : ''}
              </Text>
              <Ionicons name="chevron-forward" size={15} color="#D97706" />
            </PressableScale>
          </Animated.View>
        )}

        {/* ── Actions grid ─────────────────────────────────────────────── */}
        <Animated.View entering={FadeInDown.delay(220).duration(400)} style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.textPrimary }]}>Gestión</Text>
          <View style={[styles.grid, isDesktop && styles.gridDesktop]}>
            {ACTIONS.map(a => (
              <AdminAction key={a.label} {...a} isDesktop={isDesktop} />
            ))}
          </View>
        </Animated.View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {showSettings && (
        <SettingsModal visible={showSettings} onClose={() => setShowSettings(false)} />
      )}
    </View>
  );
}

// ─── Settings modal ───────────────────────────────────────────────────────────

function SettingsModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { theme }     = useTheme();
  const { showToast } = useToast();
  const [appTitle, setAppTitle] = useState('');
  const [logoUrl,  setLogoUrl]  = useState('');
  const [loading,  setLoading]  = useState(false);
  const [fetching, setFetching] = useState(true);

  React.useEffect(() => {
    (async () => {
      try {
        const data = (await api.get('/api/settings'))?.data ?? {};
        setAppTitle(data?.app_title ?? '');
        setLogoUrl(data?.logo_url  ?? '');
      } catch {}
      setFetching(false);
    })();
  }, []);

  const handleSave = async () => {
    setLoading(true);
    try {
      await api.patch('/api/settings', {
        settings: { app_title: appTitle.trim(), logo_url: logoUrl.trim() },
      });
      showToast('success', 'Configuración guardada');
      onClose();
    } catch (err: any) {
      showToast('error', err?.friendlyMessage || 'Error al guardar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} onClose={onClose}>
      <View style={{ alignItems: 'center', marginBottom: 20 }}>
        <View style={{
          width: 46, height: 46, borderRadius: 13,
          backgroundColor: theme.colors.surfaceElevated,
          alignItems: 'center', justifyContent: 'center', marginBottom: 10,
        }}>
          <Ionicons name="settings" size={22} color={theme.colors.primaryLight} />
        </View>
        <Text style={{
          fontSize: 18, fontFamily: 'Poppins_700Bold',
          color: theme.colors.textPrimary, letterSpacing: -0.3,
        }}>
          Configuración de App
        </Text>
        <Text style={{
          fontSize: 12, color: theme.colors.textMuted,
          fontFamily: 'Poppins_400Regular', marginTop: 3,
        }}>
          Título y logo de la pantalla de login
        </Text>
      </View>

      {fetching ? (
        <View style={{ gap: 10 }}>
          <Skeleton width="100%" height={56} style={{ borderRadius: 12 }} />
          <Skeleton width="100%" height={56} style={{ borderRadius: 12 }} />
        </View>
      ) : (
        <>
          <Input
            label="Título de la App"
            value={appTitle}
            onChangeText={setAppTitle}
            placeholder="Ej: Apuestas Mundial 2026"
            icon="text-outline"
          />
          <Input
            label="URL del Logo"
            value={logoUrl}
            onChangeText={setLogoUrl}
            placeholder="https://... (vacío para emoji)"
            icon="image-outline"
            autoCapitalize="none"
          />
          <Button
            title="Guardar Cambios"
            variant="primary"
            size="lg"
            fullWidth
            onPress={handleSave}
            loading={loading}
            icon="checkmark-circle"
            style={{ marginTop: 8 }}
          />
        </>
      )}
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

function makeStyles(t: typeof staticTheme) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: t.colors.bg },

    desktopBar: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 24,
      paddingVertical: 16,
      gap: 8,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.colors.border,
      backgroundColor: t.colors.surface,
    },
    desktopBarRole: {
      fontSize: 10,
      fontFamily: 'Poppins_600SemiBold',
      color: t.colors.textMuted,
      letterSpacing: 1.2,
      textTransform: 'uppercase',
    },
    desktopBarName: {
      fontSize: 20,
      fontFamily: 'Poppins_700Bold',
      color: t.colors.textPrimary,
      letterSpacing: -0.4,
      marginTop: 1,
    },

    hero:   { paddingBottom: 52, overflow: 'hidden' },
    heroOrb1: {
      position: 'absolute', width: 260, height: 260, borderRadius: 130,
      top: -90, right: -60, backgroundColor: t.colors.accent, opacity: 0.12,
    },
    heroOrb2: {
      position: 'absolute', width: 180, height: 180, borderRadius: 90,
      bottom: 0, left: -40, backgroundColor: t.colors.primary, opacity: 0.14,
    },
    heroHeader:   { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 22, paddingTop: 10, paddingBottom: 16, gap: 8 },
    heroGreeting: { fontSize: 10, fontFamily: 'Poppins_600SemiBold', color: 'rgba(255,255,255,0.55)', letterSpacing: 1.2, textTransform: 'uppercase' as const },
    heroName:     { fontSize: 22, fontFamily: 'Poppins_700Bold', color: '#FFF', letterSpacing: -0.5, marginTop: 2 },
    iconBtn: {
      width: 40, height: 40, borderRadius: 12,
      backgroundColor: t.colors.surfaceElevated,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.border,
      alignItems: 'center', justifyContent: 'center',
    },
    heroIconBtn: {
      width: 40, height: 40, borderRadius: 12,
      backgroundColor: 'rgba(255,255,255,0.12)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.18)',
      alignItems: 'center', justifyContent: 'center',
    },

    statsOuter: {
      marginTop: -40,
      marginHorizontal: 18,
      zIndex: 10,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.45,
      shadowRadius: 22,
      elevation: 16,
    },
    statsOuterDesktop: { marginTop: 24 },
    statsCard: {
      borderRadius: 18,
      borderWidth: StyleSheet.hairlineWidth,
      overflow: 'hidden',
    },
    statsRow: {
      flexDirection: 'row',
      paddingVertical: 16,
      paddingHorizontal: 4,
    },
    statDiv: { width: StyleSheet.hairlineWidth, marginVertical: 8 },

    alertWrap: { paddingHorizontal: 18, marginTop: 14 },
    alertCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: 'rgba(217,119,6,0.07)',
      borderRadius: 14,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: 'rgba(217,119,6,0.3)',
      padding: 13,
      gap: 9,
    },
    alertPulse: {
      width: 8, height: 8, borderRadius: 4,
      backgroundColor: '#D97706',
    },
    alertText: {
      flex: 1,
      fontSize: 12,
      fontFamily: 'Poppins_600SemiBold',
      color: '#D97706',
    },

    section: { marginTop: 26, paddingHorizontal: 18 },
    sectionTitle: {
      fontSize: 17,
      fontFamily: 'Poppins_700Bold',
      letterSpacing: -0.3,
      marginBottom: 14,
    },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
    },
    gridDesktop: { gap: 16 },
  });
}
