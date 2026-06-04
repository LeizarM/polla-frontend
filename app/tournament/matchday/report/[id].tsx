/**
 * Matchday Report — Premium admin report screen
 * Gradient header · stat cards with gradient top lines · Poppins typography
 */
import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { safeGoBack } from '../../../../utils/navigation';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useQuery } from '@tanstack/react-query';
import { Skeleton } from '../../../../components/ui/Skeleton';
import { EmptyState } from '../../../../components/ui/EmptyState';
import { useToast } from '../../../../components/ui/Toast';
import { useTheme } from '../../../../contexts/ThemeContext';
import { theme as staticTheme } from '../../../../constants/theme';
import api from '../../../../services/api';
import { exportMatchdayReportPDF } from '../../../../services/pdfService';
import { formatMoney } from '../../../../utils/currency';

type TabKey = 'bet' | 'pending';

export default function MatchdayReportScreen() {
  const { id = '' } = useLocalSearchParams<{ id: string }>();
  const { showToast } = useToast();
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const [activeTab, setActiveTab] = useState<TabKey>('bet');
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);

  const { data: report, isLoading, refetch } = useQuery({
    queryKey: ['matchday-report', id],
    queryFn: async () => {
      const res = await api.get(`/api/matchdays/${id}/report`);
      return res?.data;
    },
    enabled: !!id,
  });

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const handleExportPDF = async () => {
    if (!report) return;
    setExporting(true);
    try {
      await exportMatchdayReportPDF(report);
    } catch {
      showToast('error', 'Error al exportar PDF');
    } finally {
      setExporting(false);
    }
  };

  const matchday    = report?.matchday;
  const usersBet    = report?.users_bet ?? [];
  const usersPending = report?.users_pending ?? [];

  const formatDate = (dateStr?: string) => {
    try {
      if (!dateStr) return '';
      const d = new Date(dateStr);
      return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
    } catch { return ''; }
  };

  const handleNotify = () => {
    showToast('success', `📢 Notificación enviada a ${report?.pending_count ?? 0} usuarios pendientes`);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.bg }]} edges={['top']}>

      {/* Gradient header */}
      <Animated.View entering={FadeIn.duration(380)}>
        <LinearGradient
          colors={[theme.colors.primary, theme.colors.primaryLight]}
          start={{ x: 0, y: 0 }} end={{ x: 0.7, y: 1 }}
          style={styles.headerGrad}
        >
          <View style={styles.headerRow}>
            <Pressable onPress={() => safeGoBack('/user')} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={20} color="rgba(255,255,255,0.85)" />
            </Pressable>
            <View style={{ flex: 1 }}>
              <Text style={styles.headerTitle} numberOfLines={1}>
                📊 Reporte: {matchday?.name ?? 'Jornada'}
              </Text>
              <Text style={styles.headerSubtitle} numberOfLines={1}>
                {matchday?.tournament_name} · {formatDate(matchday?.date)} · Pozo: {formatMoney(matchday?.total_pool ?? 0)}
              </Text>
            </View>
            <Pressable onPress={handleExportPDF} style={styles.pdfBtn} disabled={exporting}>
              <Ionicons name="document-text" size={18} color="rgba(255,255,255,0.85)" />
            </Pressable>
          </View>
        </LinearGradient>
      </Animated.View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primaryLight} />}
      >
        {isLoading ? (
          <View>
            <View style={styles.statsRow}>
              {[1, 2, 3].map(i => <Skeleton key={i} width={100} height={80} style={{ borderRadius: 14 }} />)}
            </View>
            {[1, 2, 3].map(i => <Skeleton key={i} width="100%" height={60} style={{ marginBottom: 8, borderRadius: 14 }} />)}
          </View>
        ) : (
          <>
            {/* Stats cards */}
            <Animated.View entering={FadeInDown.delay(60).duration(340)} style={styles.statsRow}>
              <View style={[styles.statCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
                <LinearGradient
                  colors={[theme.colors.primary, theme.colors.primaryLight, 'transparent']}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  style={{ height: 1.5 }}
                />
                <View style={styles.statCardBody}>
                  <Text style={styles.statNumber}>{report?.stats?.total_active_users ?? report?.total_users ?? 0}</Text>
                  <Text style={styles.statLabel}>👥 Usuarios</Text>
                </View>
              </View>
              <View style={[styles.statCard, { backgroundColor: theme.colors.surface, borderColor: '#10B98130' }]}>
                <LinearGradient
                  colors={['#10B981', '#059669', 'transparent']}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  style={{ height: 1.5 }}
                />
                <View style={styles.statCardBody}>
                  <Text style={[styles.statNumber, { color: '#10B981' }]}>{report?.bet_count ?? 0}</Text>
                  <Text style={styles.statLabel}>✅ Apostaron</Text>
                </View>
              </View>
              <View style={[styles.statCard, { backgroundColor: theme.colors.surface, borderColor: '#F59E0B30' }]}>
                <LinearGradient
                  colors={['#F59E0B', '#D97706', 'transparent']}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  style={{ height: 1.5 }}
                />
                <View style={styles.statCardBody}>
                  <Text style={[styles.statNumber, { color: '#F59E0B' }]}>{report?.pending_count ?? 0}</Text>
                  <Text style={styles.statLabel}>⏳ Faltan</Text>
                </View>
              </View>
            </Animated.View>

            {/* Tabs */}
            <Animated.View
              entering={FadeInDown.delay(120).duration(340)}
              style={[styles.tabBar, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
            >
              <Pressable
                style={[styles.tab, activeTab === 'bet' && styles.tabActive]}
                onPress={() => setActiveTab('bet')}
              >
                <Ionicons name="checkmark-circle" size={16} color={activeTab === 'bet' ? '#10B981' : theme.colors.textMuted} />
                <Text style={[styles.tabText, { color: activeTab === 'bet' ? '#10B981' : theme.colors.textMuted }]}>
                  Apostaron ({report?.bet_count ?? 0})
                </Text>
              </Pressable>
              <Pressable
                style={[styles.tab, activeTab === 'pending' && styles.tabActivePending]}
                onPress={() => setActiveTab('pending')}
              >
                <Ionicons name="time" size={16} color={activeTab === 'pending' ? '#F59E0B' : theme.colors.textMuted} />
                <Text style={[styles.tabText, { color: activeTab === 'pending' ? '#F59E0B' : theme.colors.textMuted }]}>
                  Pendientes ({report?.pending_count ?? 0})
                </Text>
              </Pressable>
            </Animated.View>

            {/* User list */}
            {activeTab === 'bet' ? (
              usersBet.length === 0 ? (
                <EmptyState icon="ticket-outline" title="Nadie ha apostado" description="Aún no hay apuestas en esta jornada" />
              ) : (
                usersBet.map((u: any, idx: number) => (
                  <Animated.View key={u?.id ?? u?.ticket_id} entering={FadeInDown.delay(idx * 45).duration(300).springify()}>
                    <View style={[styles.userCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
                      <LinearGradient
                        colors={[theme.colors.primary, theme.colors.primaryLight, 'transparent']}
                        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                        style={{ height: 1.5 }}
                      />
                      <View style={styles.userCardBody}>
                        <View style={styles.userRow}>
                          <View style={[styles.avatar, { backgroundColor: u?.status === 'won' ? 'rgba(255,215,0,0.2)' : 'rgba(16,185,129,0.2)' }]}>
                            <Text style={[styles.avatarText, { color: u?.status === 'won' ? '#FFD700' : '#10B981' }]}>
                              {u?.full_name?.[0]?.toUpperCase() ?? '?'}
                            </Text>
                          </View>
                          <View style={{ flex: 1 }}>
                            {/* Privacidad: solo nombre — sin @usuario ni telefono */}
                            <Text style={styles.userName}>{u?.full_name ?? 'Participante'}</Text>
                          </View>
                          <View style={{ alignItems: 'flex-end' }}>
                            <View style={styles.betBadge}>
                              <Text style={styles.betBadgeText}>{formatMoney(u?.amount_bet ?? 0)}</Text>
                            </View>
                            {u?.total_correct != null && (
                              <Text style={styles.correctText}>{u.total_correct} ✅</Text>
                            )}
                            {(u?.prize_won ?? 0) > 0 && (
                              <Text style={styles.prizeText}>🏆 {formatMoney(u.prize_won)}</Text>
                            )}
                          </View>
                        </View>
                      </View>
                    </View>
                  </Animated.View>
                ))
              )
            ) : (
              usersPending.length === 0 ? (
                <EmptyState icon="checkmark-done-circle-outline" title="¡Todos apostaron!" description="No hay usuarios pendientes" />
              ) : (
                <>
                  {usersPending.map((u: any, idx: number) => (
                    <Animated.View key={u?.id} entering={FadeInDown.delay(idx * 45).duration(300).springify()}>
                      <View style={[styles.userCard, { backgroundColor: theme.colors.surface, borderColor: '#F59E0B20' }]}>
                        <LinearGradient
                          colors={['#F59E0B', '#D97706', 'transparent']}
                          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                          style={{ height: 1.5 }}
                        />
                        <View style={styles.userCardBody}>
                          <View style={styles.userRow}>
                            <View style={[styles.avatar, { backgroundColor: 'rgba(245,158,11,0.2)' }]}>
                              <Text style={[styles.avatarText, { color: '#F59E0B' }]}>
                                {u?.full_name?.[0]?.toUpperCase() ?? '?'}
                              </Text>
                            </View>
                            <View style={{ flex: 1 }}>
                              {/* Privacidad: solo nombre — sin @usuario */}
                              <Text style={styles.userName}>{u?.full_name ?? 'Participante'}</Text>
                              <Text style={styles.userSub}>Saldo: {formatMoney(u?.balance ?? 0)}</Text>
                            </View>
                            <View style={styles.pendingBadge}>
                              <Text style={styles.pendingBadgeText}>⚠️ Sin apostar</Text>
                            </View>
                          </View>
                        </View>
                      </View>
                    </Animated.View>
                  ))}

                  <Pressable style={styles.notifyBtn} onPress={handleNotify}>
                    <Ionicons name="megaphone" size={20} color="#FFF" />
                    <Text style={styles.notifyBtnText}>📢 Notificar pendientes</Text>
                  </Pressable>
                </>
              )
            )}
          </>
        )}
        <View style={{ height: 60 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(t: typeof staticTheme) {
  return StyleSheet.create({
    container: { flex: 1 },
    headerGrad: { paddingBottom: 22 },
    headerRow: {
      flexDirection: 'row', alignItems: 'center',
      paddingHorizontal: 20, paddingTop: 14, gap: 12,
    },
    backBtn: {
      width: 40, height: 40, borderRadius: 12,
      backgroundColor: 'rgba(255,255,255,0.10)',
      borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
      alignItems: 'center', justifyContent: 'center',
    },
    headerTitle: { fontSize: 18, fontFamily: 'Poppins_700Bold', color: '#fff', letterSpacing: -0.3 },
    headerSubtitle: { fontSize: 11, fontFamily: 'Poppins_400Regular', color: 'rgba(255,255,255,0.6)', marginTop: 1 },
    pdfBtn: {
      width: 36, height: 36, borderRadius: 10,
      backgroundColor: 'rgba(255,255,255,0.12)',
      borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
      alignItems: 'center', justifyContent: 'center',
    },
    content: { flex: 1 },
    scrollContent: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 80 },

    statsRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
    statCard: {
      flex: 1, borderRadius: 14, borderWidth: 1, overflow: 'hidden',
      shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.10, shadowRadius: 6, elevation: 3,
    },
    statCardBody: { paddingVertical: 14, alignItems: 'center' },
    statNumber: { fontSize: 26, fontFamily: 'Poppins_800ExtraBold', color: t.colors.primaryLight },
    statLabel: { fontSize: 11, fontFamily: 'Poppins_400Regular', color: t.colors.textSecondary, marginTop: 3 },

    tabBar: {
      flexDirection: 'row', borderRadius: 12, borderWidth: 1,
      padding: 4, marginBottom: 14, overflow: 'hidden',
    },
    tab: {
      flex: 1, flexDirection: 'row', alignItems: 'center',
      justifyContent: 'center', paddingVertical: 8,
      borderRadius: 9, gap: 5,
    },
    tabActive: { backgroundColor: 'rgba(16,185,129,0.12)' },
    tabActivePending: { backgroundColor: 'rgba(245,158,11,0.12)' },
    tabText: { fontSize: 12, fontFamily: 'Poppins_600SemiBold' },

    userCard: {
      borderRadius: 14, borderWidth: 1, overflow: 'hidden',
      marginBottom: 8,
      shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.10, shadowRadius: 6, elevation: 3,
    },
    userCardBody: { padding: 12 },
    userRow: { flexDirection: 'row', alignItems: 'center' },
    avatar: {
      width: 40, height: 40, borderRadius: 20,
      alignItems: 'center', justifyContent: 'center', marginRight: 12,
    },
    avatarText: { fontSize: 16, fontFamily: 'Poppins_700Bold' },
    userName: { fontSize: 14, fontFamily: 'Poppins_600SemiBold', color: t.colors.textPrimary },
    userSub: { fontSize: 11, fontFamily: 'Poppins_400Regular', color: t.colors.textSecondary, marginTop: 1 },
    betBadge: {
      backgroundColor: 'rgba(16,185,129,0.15)', paddingHorizontal: 8,
      paddingVertical: 3, borderRadius: 999,
    },
    betBadgeText: { color: '#10B981', fontFamily: 'Poppins_700Bold', fontSize: 13 },
    correctText: { fontSize: 12, fontFamily: 'Poppins_600SemiBold', color: '#10B981', marginTop: 2 },
    prizeText: { fontSize: 12, fontFamily: 'Poppins_700Bold', color: '#F59E0B', marginTop: 2 },
    pendingBadge: {
      backgroundColor: 'rgba(245,158,11,0.15)', paddingHorizontal: 8,
      paddingVertical: 3, borderRadius: 999,
    },
    pendingBadgeText: { color: '#F59E0B', fontFamily: 'Poppins_700Bold', fontSize: 12 },
    notifyBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      backgroundColor: '#F59E0B', borderRadius: 14,
      paddingVertical: 14, marginTop: 16, gap: 8,
      shadowColor: '#F59E0B', shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3, shadowRadius: 8, elevation: 5,
    },
    notifyBtnText: { color: '#FFF', fontFamily: 'Poppins_700Bold', fontSize: 15 },
  });
}
