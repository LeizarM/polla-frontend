/**
 * Matchday Winners — Premium winners leaderboard screen
 * Gradient header · gold summary card · medal-colored cards · Poppins typography
 */
import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { safeGoBack } from '../../../../utils/navigation';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useQuery } from '@tanstack/react-query';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { Skeleton } from '../../../../components/ui/Skeleton';
import { EmptyState } from '../../../../components/ui/EmptyState';
import { useTheme } from '../../../../contexts/ThemeContext';
import { theme as staticTheme } from '../../../../constants/theme';
import api from '../../../../services/api';

export default function MatchdayWinnersScreen() {
  const { id = '' } = useLocalSearchParams<{ id: string }>();
  const [refreshing, setRefreshing] = useState(false);
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['matchday-winners', id],
    queryFn: async () => {
      const res = await api.get(`/api/matchdays/${id}/winners`);
      return res?.data;
    },
    enabled: !!id,
  });

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const matchday      = data?.matchday;
  const cur           = matchday?.currency ?? 'Bs';
  const winners       = data?.winners ?? [];
  const allTickets    = data?.all_tickets ?? [];
  const maxCorrect    = data?.max_correct ?? 0;
  const prizePerWinner = data?.prize_per_winner ?? 0;

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.bg }]} edges={['top']}>
        <LinearGradient
          colors={[theme.colors.primary, theme.colors.primaryLight]}
          start={{ x: 0, y: 0 }} end={{ x: 0.7, y: 1 }}
          style={styles.headerGrad}
        >
          <View style={styles.headerRow}>
            <Pressable onPress={() => safeGoBack('/user')} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={20} color="rgba(255,255,255,0.85)" />
            </Pressable>
          </View>
        </LinearGradient>
        <View style={{ padding: 20, gap: 12 }}>
          <Skeleton width="100%" height={120} style={{ borderRadius: 14 }} />
          <Skeleton width="100%" height={60} style={{ borderRadius: 14 }} />
          <Skeleton width="100%" height={60} style={{ borderRadius: 14 }} />
        </View>
      </SafeAreaView>
    );
  }

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
                {matchday?.name ?? 'Jornada'}
              </Text>
              <Text style={styles.headerSubtitle} numberOfLines={1}>
                {matchday?.tournament_name}
              </Text>
            </View>
            <View style={styles.headerIcon}>
              <Ionicons name="trophy" size={20} color="#FFD700" />
            </View>
          </View>
        </LinearGradient>
      </Animated.View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primaryLight} />
        }
      >
        {/* Gold summary card */}
        <Animated.View entering={FadeInDown.delay(60).duration(380)}>
          <View style={[styles.summaryCard, { backgroundColor: theme.colors.surface }]}>
            <LinearGradient
              colors={['#FFD700', '#F59E0B', 'transparent']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={{ height: 1.5 }}
            />
            <View style={styles.summaryBody}>
              <View style={styles.trophyRow}>
                <Ionicons name="trophy" size={40} color="#F59E0B" />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.summaryTitle}>
                    {winners?.length > 0
                      ? `${winners.length} Ganador${winners.length > 1 ? 'es' : ''}`
                      : 'Sin ganadores'}
                  </Text>
                  <Text style={styles.summarySubtext}>Máximo aciertos: {maxCorrect}</Text>
                </View>
              </View>
              <View style={[styles.statsRow, { borderTopColor: theme.colors.border }]}>
                <View style={styles.statItem}>
                  <Text style={[styles.statValue, { color: theme.colors.textPrimary }]}>
                    {cur} {Number(matchday?.total_pool ?? 0).toFixed(2)}
                  </Text>
                  <Text style={[styles.statLabel, { color: theme.colors.textMuted }]}>Pozo Total</Text>
                </View>
                <View style={[styles.statDivider, { backgroundColor: theme.colors.border }]} />
                <View style={styles.statItem}>
                  <Text style={[styles.statValue, { color: '#10B981' }]}>
                    {cur} {Number(prizePerWinner).toFixed(2)}
                  </Text>
                  <Text style={[styles.statLabel, { color: theme.colors.textMuted }]}>Premio c/u</Text>
                </View>
              </View>
            </View>
          </View>
        </Animated.View>

        {/* Winners section */}
        {winners?.length > 0 && (
          <>
            <Text style={[styles.sectionTitle, { color: theme.colors.textPrimary }]}>🏆 Ganadores</Text>
            {winners.map((ticket: any, index: number) => (
              <Animated.View key={ticket?.user_id ?? index} entering={FadeInDown.delay(140 + index * 70).duration(320).springify()}>
                <View style={[styles.ticketCard, { backgroundColor: theme.colors.surface, borderColor: '#FFD70050' }]}>
                  <LinearGradient
                    colors={['#FFD700', '#F59E0B', 'transparent']}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                    style={{ height: 1.5 }}
                  />
                  <View style={styles.ticketCardBody}>
                    <View style={styles.ticketRow}>
                      <View style={styles.positionBadge}>
                        <Text style={styles.positionText}>🥇</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.ticketName, { color: theme.colors.textPrimary }]}>
                          {ticket?.full_name ?? 'Usuario'}
                        </Text>
                        {/* Privacidad: solo nombre — sin @usuario */}
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={styles.ticketCorrect}>{ticket?.total_correct} ✓</Text>
                        <Text style={styles.ticketPrize}>
                          {cur} {Number(ticket?.prize_won ?? 0).toFixed(2)}
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>
              </Animated.View>
            ))}
          </>
        )}

        {/* All participants table */}
        <Text style={[styles.sectionTitle, { color: theme.colors.textPrimary }]}>📊 Tabla de Posiciones</Text>
        {allTickets?.length === 0 ? (
          <EmptyState icon="people-outline" title="Sin participantes" description="Nadie apostó en esta jornada" />
        ) : (
          allTickets.map((ticket: any, index: number) => {
            const isWinner = ticket?.status === 'won';
            return (
              <Animated.View
                key={`${ticket?.user_id}-${index}`}
                entering={FadeInDown.delay(220 + index * 45).duration(280).springify()}
              >
                <View style={[
                  styles.ticketCard,
                  { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
                  isWinner && { borderColor: '#FFD70040', borderLeftWidth: 3, borderLeftColor: '#F59E0B' },
                ]}>
                  <LinearGradient
                    colors={isWinner
                      ? ['#FFD700', '#F59E0B', 'transparent']
                      : [theme.colors.border, theme.colors.border, theme.colors.border]}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                    style={{ height: 1.5 }}
                  />
                  <View style={styles.ticketCardBody}>
                    <View style={styles.ticketRow}>
                      <View style={[styles.rankCircle, isWinner && { backgroundColor: 'rgba(245,158,11,0.25)' }]}>
                        <Text style={[styles.rankText, { color: isWinner ? '#F59E0B' : theme.colors.textSecondary }]}>
                          {ticket?.position > 0 ? ticket.position : '-'}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.ticketName, { color: theme.colors.textPrimary }]}>
                          {ticket?.full_name ?? 'Usuario'}
                        </Text>
                        {/* Privacidad: solo nombre — sin @usuario */}
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={[styles.ticketCorrect, isWinner && { color: '#F59E0B' }]}>
                          {ticket?.total_correct ?? 0} aciertos
                        </Text>
                        {isWinner && (
                          <Text style={styles.ticketPrize}>
                            {cur} {Number(ticket?.prize_won ?? 0).toFixed(2)}
                          </Text>
                        )}
                      </View>
                    </View>
                  </View>
                </View>
              </Animated.View>
            );
          })
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
    headerTitle: { fontSize: 20, fontFamily: 'Poppins_700Bold', color: '#fff', letterSpacing: -0.3 },
    headerSubtitle: { fontSize: 12, fontFamily: 'Poppins_400Regular', color: 'rgba(255,255,255,0.6)', marginTop: 1 },
    headerIcon: {
      width: 42, height: 42, borderRadius: 13,
      backgroundColor: 'rgba(255,255,255,0.12)',
      alignItems: 'center', justifyContent: 'center',
    },
    content: { flex: 1 },
    scrollContent: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 80 },

    summaryCard: {
      borderRadius: 18, overflow: 'hidden', marginBottom: 20,
      borderWidth: 1, borderColor: 'rgba(245,158,11,0.30)',
      shadowColor: '#F59E0B', shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15, shadowRadius: 12, elevation: 5,
    },
    summaryBody: { padding: 16 },
    trophyRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
    summaryTitle: { fontSize: 18, fontFamily: 'Poppins_700Bold', color: '#F59E0B' },
    summarySubtext: { fontSize: 13, fontFamily: 'Poppins_400Regular', color: '#94A3B8', marginTop: 2 },
    statsRow: {
      flexDirection: 'row', alignItems: 'center',
      borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 14,
    },
    statItem: { flex: 1, alignItems: 'center' },
    statDivider: { width: 1, height: 30 },
    statValue: { fontSize: 17, fontFamily: 'Poppins_700Bold' },
    statLabel: { fontSize: 11, fontFamily: 'Poppins_400Regular', marginTop: 2 },

    sectionTitle: {
      fontSize: 16, fontFamily: 'Poppins_700Bold', letterSpacing: -0.2,
      marginBottom: 10, marginTop: 4,
    },
    ticketCard: {
      borderRadius: 14, borderWidth: 1, overflow: 'hidden',
      marginBottom: 8,
      shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.10, shadowRadius: 6, elevation: 3,
    },
    ticketCardBody: { padding: 12 },
    ticketRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    positionBadge: {
      width: 36, height: 36, borderRadius: 18,
      backgroundColor: 'rgba(245,158,11,0.2)',
      alignItems: 'center', justifyContent: 'center',
    },
    positionText: { fontSize: 18 },
    rankCircle: {
      width: 32, height: 32, borderRadius: 16,
      backgroundColor: 'rgba(255,255,255,0.08)',
      alignItems: 'center', justifyContent: 'center',
    },
    rankText: { fontFamily: 'Poppins_700Bold', fontSize: 13 },
    ticketName: { fontSize: 14, fontFamily: 'Poppins_600SemiBold' },
    ticketUsername: { fontSize: 11, fontFamily: 'Poppins_400Regular', marginTop: 1 },
    ticketCorrect: { fontSize: 13, fontFamily: 'Poppins_700Bold', color: '#60A5FA' },
    ticketPrize: { fontSize: 12, fontFamily: 'Poppins_600SemiBold', color: '#10B981', marginTop: 2 },
  });
}
