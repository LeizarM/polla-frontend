/**
 * Inscripción a Torneos — Premium enrollment screen
 * Gradient header · tournament cards with stats · animated list
 */
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  Pressable, RefreshControl, Platform,
} from 'react-native';
import { SafeAreaView }   from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons }       from '@expo/vector-icons';
import { router }         from 'expo-router';
import { safeGoBack }     from '../../utils/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { Badge }      from '../../components/ui/Badge';
import { Button }     from '../../components/ui/Button';
import { Skeleton }   from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import { useToast }   from '../../components/ui/Toast';
import { useTheme }   from '../../contexts/ThemeContext';
import api from '../../services/api';

export default function TorneosInscripcionScreen() {
  const { theme }     = useTheme();
  const { showToast } = useToast();
  const queryClient   = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  const { data: tournaments, isLoading, refetch } = useQuery({
    queryKey: ['tournaments-active'],
    queryFn: async () => {
      try { const res = await api.get('/api/tournaments?status=active'); return res?.data ?? []; }
      catch { return []; }
    },
  });

  const { data: myParticipations, refetch: refetchPart } = useQuery({
    queryKey: ['my-participations'],
    queryFn: async () => {
      try { const res = await api.get('/api/tournament-participants/me'); return res?.data ?? []; }
      catch { return []; }
    },
  });

  const requestMutation = useMutation({
    mutationFn: async (tournamentId: string) => {
      const res = await api.post('/api/tournament-participants', { tournament_id: tournamentId });
      return res?.data;
    },
    onSuccess: () => {
      if (Platform.OS !== 'web') Haptics.notificationAsync?.(Haptics.NotificationFeedbackType.Success);
      showToast('success', '✅ Solicitud enviada correctamente');
      queryClient.invalidateQueries({ queryKey: ['my-participations'] });
    },
    onError: (err: any) => {
      showToast('error', err?.response?.data?.message ?? err?.message ?? 'Error al solicitar');
    },
  });

  const partMap = new Map<string, string>();
  (myParticipations ?? []).forEach((p: any) => { partMap.set(p?.tournament_id, p?.status); });

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refetch(), refetchPart()]);
    setRefreshing(false);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.bg }]} edges={['top']}>

      {/* Gradient header */}
      <LinearGradient
        colors={[theme.colors.primary, theme.colors.primaryLight]}
        start={{ x: 0, y: 0 }} end={{ x: 0.7, y: 1 }}
        style={styles.headerGrad}
      >
        <Animated.View entering={FadeIn.duration(380)} style={styles.headerRow}>
          <Pressable
            onPress={() => safeGoBack('/user')}
            style={styles.backBtn}
          >
            <Ionicons name="arrow-back" size={20} color="rgba(255,255,255,0.85)" />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Inscripción</Text>
            <Text style={styles.headerSub}>Solicita tu lugar en los torneos</Text>
          </View>
          <View style={styles.headerIcon}>
            <Ionicons name="trophy" size={20} color="#FFD700" />
          </View>
        </Animated.View>
      </LinearGradient>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primaryLight} />
        }
      >
        {/* Info banner */}
        <Animated.View entering={FadeInDown.delay(60).duration(320)} style={[styles.infoBanner, { backgroundColor: theme.colors.primaryLight + '12', borderColor: theme.colors.primaryLight + '30' }]}>
          <Ionicons name="information-circle-outline" size={16} color={theme.colors.primaryLight} />
          <Text style={[styles.infoText, { color: theme.colors.textSecondary }]}>
            Solicita tu inscripción. El administrador revisará y aprobará tu solicitud.
          </Text>
        </Animated.View>

        {/* Tournament list */}
        {isLoading ? (
          <View style={{ gap: 14 }}>
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} width="100%" height={160} style={{ borderRadius: 18 }} />
            ))}
          </View>
        ) : (tournaments?.length ?? 0) === 0 ? (
          <EmptyState
            icon="trophy-outline"
            title="Sin torneos activos"
            description="No hay torneos disponibles por el momento"
          />
        ) : (
          <View style={{ gap: 14 }}>
            {(tournaments ?? []).map((t: any, idx: number) => {
              const myStatus = partMap.get(t?.id);
              return (
                <Animated.View
                  key={t?.id}
                  entering={FadeInDown.delay(80 + idx * 80).duration(380).springify()}
                >
                  <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
                    {/* Gradient top line */}
                    <LinearGradient
                      colors={[theme.colors.primary, theme.colors.primaryLight, 'transparent']}
                      start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                      style={{ height: 1.5 }}
                    />
                    <View style={{ padding: 18 }}>
                      {/* Header */}
                      <View style={styles.cardHeader}>
                        <View style={[styles.cardIconWrap, { backgroundColor: theme.colors.primaryLight + '18' }]}>
                          <Ionicons name="trophy" size={20} color={theme.colors.primaryLight} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.cardName, { color: theme.colors.textPrimary }]} numberOfLines={1}>
                            {t?.name ?? '—'}
                          </Text>
                          {(t?.start_date || t?.end_date) && (
                            <Text style={[styles.cardDates, { color: theme.colors.textMuted }]}>
                              {t?.start_date ? (() => { const d = new Date(t.start_date); return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`; })() : '—'}
                              {' → '}
                              {t?.end_date ? (() => { const d = new Date(t.end_date); return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`; })() : '—'}
                            </Text>
                          )}
                        </View>
                        {myStatus && (
                          <Badge
                            status={myStatus === 'approved' ? 'active' : myStatus === 'pending' ? 'pending' : 'blocked'}
                            text={myStatus === 'approved' ? 'Inscrito' : myStatus === 'pending' ? 'Pendiente' : 'Rechazado'}
                          />
                        )}
                      </View>

                      {/* Stats row */}
                      <View style={[styles.statsRow, { borderTopColor: theme.colors.border }]}>
                        <View style={styles.statItem}>
                          <Text style={[styles.statVal, { color: theme.colors.textPrimary }]}>
                            {t?.currency ?? 'Bs'} {Number(t?.bet_per_matchday ?? 0)}
                          </Text>
                          <Text style={[styles.statLabel, { color: theme.colors.textMuted }]}>Por jornada</Text>
                        </View>
                        <View style={[styles.statDivider, { backgroundColor: theme.colors.border }]} />
                        <View style={styles.statItem}>
                          <Text style={[styles.statVal, { color: theme.colors.textPrimary }]}>
                            {t?.currency ?? 'Bs'} {Number(t?.bet_final ?? 0)}
                          </Text>
                          <Text style={[styles.statLabel, { color: theme.colors.textMuted }]}>Polla final</Text>
                        </View>
                        <View style={[styles.statDivider, { backgroundColor: theme.colors.border }]} />
                        <View style={styles.statItem}>
                          <Text style={[styles.statVal, { color: theme.colors.textPrimary }]}>
                            {t?._count?.participants ?? 0}
                          </Text>
                          <Text style={[styles.statLabel, { color: theme.colors.textMuted }]}>Participantes</Text>
                        </View>
                      </View>

                      {/* CTA */}
                      {!myStatus ? (
                        <Button
                          title="Solicitar Inscripción"
                          icon="add-circle-outline"
                          fullWidth
                          onPress={() => requestMutation.mutate(t?.id)}
                          loading={requestMutation.isPending}
                          style={{ marginTop: 14 }}
                        />
                      ) : myStatus === 'rejected' ? (
                        <Button
                          title="Volver a Solicitar"
                          icon="refresh-outline"
                          variant="outline"
                          fullWidth
                          onPress={() => requestMutation.mutate(t?.id)}
                          loading={requestMutation.isPending}
                          style={{ marginTop: 14 }}
                        />
                      ) : myStatus === 'approved' ? (
                        <View style={[styles.approvedRow, { backgroundColor: '#10B98112', borderColor: '#10B98130' }]}>
                          <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                          <Text style={styles.approvedText}>Ya estás inscrito en este torneo</Text>
                        </View>
                      ) : (
                        <View style={[styles.approvedRow, { backgroundColor: theme.colors.primaryLight + '12', borderColor: theme.colors.primaryLight + '30' }]}>
                          <Ionicons name="time-outline" size={16} color={theme.colors.primaryLight} />
                          <Text style={[styles.approvedText, { color: theme.colors.primaryLight }]}>
                            Solicitud en revisión
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                </Animated.View>
              );
            })}
          </View>
        )}
        <View style={{ height: 80 }} />
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
  backBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 22, fontFamily: 'Poppins_800ExtraBold',
    color: '#fff', letterSpacing: -0.4,
  },
  headerSub: {
    fontSize: 12, fontFamily: 'Poppins_400Regular',
    color: 'rgba(255,255,255,0.6)', marginTop: 1,
  },
  headerIcon: {
    width: 42, height: 42, borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },

  scrollContent: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 40 },

  infoBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderRadius: 12, borderWidth: 1,
    paddingHorizontal: 14, paddingVertical: 10,
    marginBottom: 20,
  },
  infoText: { flex: 1, fontSize: 12, fontFamily: 'Poppins_400Regular', lineHeight: 18 },

  card: {
    borderRadius: 18, borderWidth: 1, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25, shadowRadius: 14, elevation: 7,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  cardIconWrap: {
    width: 44, height: 44, borderRadius: 13,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  cardName: { fontSize: 16, fontFamily: 'Poppins_700Bold', letterSpacing: -0.2 },
  cardDates: { fontSize: 11, fontFamily: 'Poppins_400Regular', marginTop: 3 },

  statsRow: {
    flexDirection: 'row', marginTop: 14, paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  statItem: { flex: 1, alignItems: 'center', gap: 3 },
  statVal: { fontSize: 14, fontFamily: 'Poppins_700Bold', letterSpacing: -0.2 },
  statLabel: { fontSize: 10, fontFamily: 'Poppins_400Regular' },
  statDivider: { width: 1, marginVertical: 4 },

  approvedRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginTop: 14, borderRadius: 10, borderWidth: 1,
    paddingHorizontal: 12, paddingVertical: 9,
  },
  approvedText: { fontSize: 13, fontFamily: 'Poppins_600SemiBold', color: '#10B981' },
});
