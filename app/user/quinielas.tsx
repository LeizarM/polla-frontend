/**
 * Quinielas — Premium matchday list with filter chips
 * Gradient card headers · stagger animations · Poppins typography
 */
import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, RefreshControl,
  Pressable, FlatList,
} from 'react-native';
import { SafeAreaView }   from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons }       from '@expo/vector-icons';
import { useQuery }       from '@tanstack/react-query';
import { router }         from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { Badge }      from '../../components/ui/Badge';
import { Skeleton }   from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import { useTheme }   from '../../contexts/ThemeContext';
import { parseBackendDate } from '../../utils/date';
import api from '../../services/api';

type FilterType = 'all' | 'open' | 'finished';

interface MatchdayItem {
  id: string; name: string; date: string; status: string;
  total_pool: number; expected_pool?: number;
  tournament?: { id: string; name: string; min_bet: number | string; max_bet: number | string; currency?: string };
  matches?: any[];
}

function formatCurrency(amount: number, currency = 'Bs') {
  return `${currency} ${Number(amount ?? 0).toFixed(2)}`;
}
function formatDate(dateStr: string) {
  try {
    // parseBackendDate evita el shift de timezone (la fecha @db.Date viene como
    // medianoche UTC; new Date() la mostraria un dia antes en UTC-4).
    const d = parseBackendDate(dateStr) ?? new Date(dateStr);
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
  } catch { return dateStr ?? ''; }
}

// ─── Matchday card ─────────────────────────────────────────────────────────────

function MatchdayCard({
  item, ticketCount, myTickets, theme,
}: { item: MatchdayItem; ticketCount: number; myTickets: any[]; theme: any }) {
  const isOpen     = item?.status === 'open';
  const currency   = item?.tournament?.currency ?? 'Bs';
  const matchCount = item?.matches?.length ?? 0;

  const handlePress = () => {
    if (isOpen) {
      // Open jornada → take user to bet/edit screen
      router.push(`/quiniela/${item?.id}` as any);
    } else {
      // Resolved/finished → take user directly to the ranking
      // (from the ranking they can navigate to their ticket if needed)
      router.push(`/quiniela/ranking/${item?.id}?tournamentId=${item?.tournament_id ?? ''}` as any);
    }
  };

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, opacity: pressed ? 0.85 : 1 },
      ]}
    >
      {/* Gradient top line */}
      <LinearGradient
        colors={isOpen
          ? [theme.colors.primary, theme.colors.primaryLight]
          : [theme.colors.border, theme.colors.border]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
        style={styles.cardTopLine}
      />
      <View style={styles.cardBody}>
        {/* Header row */}
        <View style={styles.cardHeader}>
          <View style={{ flex: 1, marginRight: 10 }}>
            <Text style={[styles.cardName, { color: theme.colors.textPrimary }]} numberOfLines={1}>
              {item?.name ?? 'Jornada'}
            </Text>
            <Text style={[styles.cardTournament, { color: theme.colors.textSecondary }]} numberOfLines={1}>
              {item?.tournament?.name ?? 'Torneo'}
            </Text>
          </View>
          <Badge status={item?.status as any ?? 'pending'} />
        </View>

        {/* Stats */}
        <View style={styles.cardStats}>
          {item?.date ? (
            <View style={styles.stat}>
              <Ionicons name="calendar-outline" size={13} color={theme.colors.textMuted} />
              <Text style={[styles.statText, { color: theme.colors.textMuted }]}>{formatDate(item.date)}</Text>
            </View>
          ) : null}
          {matchCount > 0 && (
            <View style={styles.stat}>
              <Ionicons name="football-outline" size={13} color={theme.colors.textMuted} />
              <Text style={[styles.statText, { color: theme.colors.textMuted }]}>{matchCount} partidos</Text>
            </View>
          )}
          <View style={styles.stat}>
            <Ionicons name="cash-outline" size={13} color="#10B981" />
            <Text style={[styles.statText, { color: '#10B981', fontFamily: 'Poppins_600SemiBold' }]}>
              {formatCurrency(item?.expected_pool ?? item?.total_pool ?? 0, currency)}
            </Text>
          </View>
        </View>

        {/* CTA */}
        <View style={styles.cardBottom}>
          {ticketCount > 0 ? (
            <View style={[styles.ticketBadge]}>
              <Ionicons name="ticket" size={13} color="#FFD700" />
              <Text style={styles.ticketBadgeText}>
                {ticketCount} boleto{ticketCount > 1 ? 's' : ''}
              </Text>
            </View>
          ) : isOpen ? (
            <LinearGradient
              colors={[theme.colors.primary, theme.colors.primaryLight]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={styles.ctaGrad}
            >
              <Text style={styles.ctaText}>¡Apostar!</Text>
              <Ionicons name="arrow-forward" size={13} color="#fff" />
            </LinearGradient>
          ) : (
            <Text style={[styles.closedText, { color: theme.colors.textMuted }]}>Finalizada</Text>
          )}
        </View>
      </View>
    </Pressable>
  );
}

// ─── Screen ────────────────────────────────────────────────────────────────────

export default function QuinielasScreen() {
  const [filter, setFilter] = useState<FilterType>('all');
  const { theme }           = useTheme();
  const [refreshing, setRefreshing] = useState(false);

  const { data: matchdays, isLoading, refetch } = useQuery({
    queryKey: ['user-matchdays'],
    queryFn: async () => {
      // upcoming=true → jornadas visibles desde 1 día antes de su fecha
      try { const res = await api.get('/api/matchdays?upcoming=true'); return (res?.data ?? []) as MatchdayItem[]; }
      catch { return [] as MatchdayItem[]; }
    },
  });

  const { data: myTickets, refetch: refetchTickets } = useQuery({
    queryKey: ['my-tickets-all'],
    queryFn: async () => {
      try { const res = await api.get('/api/tickets/me'); return res?.data ?? []; }
      catch { return []; }
    },
  });

  useFocusEffect(useCallback(() => { refetch(); refetchTickets(); }, []));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refetch(), refetchTickets()]);
    setRefreshing(false);
  }, [refetch, refetchTickets]);

  const ticketsByMatchday: Record<string, number> = {};
  (myTickets ?? []).forEach((t: any) => {
    const mid = t?.matchday_id ?? '';
    if (mid) ticketsByMatchday[mid] = (ticketsByMatchday[mid] ?? 0) + 1;
  });

  const filtered = (matchdays ?? []).filter((m: MatchdayItem) => {
    if (filter === 'open') return m?.status === 'open';
    if (filter === 'finished') return m?.status === 'resolved' || m?.status === 'finished';
    return true;
  });

  const openCount = (matchdays ?? []).filter((m: MatchdayItem) => m?.status === 'open').length;

  const FILTERS: { key: FilterType; label: string; icon: string }[] = [
    { key: 'all',      label: 'Todas',      icon: 'list-outline'            },
    { key: 'open',     label: 'Activas',    icon: 'flash-outline'           },
    { key: 'finished', label: 'Finalizadas', icon: 'checkmark-circle-outline' },
  ];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.bg }]} edges={['top']}>
      {/* Header */}
      <Animated.View entering={FadeIn.duration(350)} style={styles.header}>
        <View>
          <Text style={[styles.title, { color: theme.colors.textPrimary }]}>Apuestas</Text>
          <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
            Jornadas disponibles
          </Text>
        </View>
        {openCount > 0 && (
          <View style={[styles.openBadge, { backgroundColor: theme.colors.primaryLight + '20', borderColor: theme.colors.primaryLight + '40' }]}>
            <View style={[styles.openDot, { backgroundColor: theme.colors.primaryLight }]} />
            <Text style={[styles.openBadgeText, { color: theme.colors.primaryLight }]}>
              {openCount} activa{openCount > 1 ? 's' : ''}
            </Text>
          </View>
        )}
      </Animated.View>

      {/* Filter chips */}
      <Animated.View entering={FadeInDown.delay(60).duration(300)} style={styles.filterRow}>
        {FILTERS.map((f) => {
          const active = filter === f.key;
          return (
            <Pressable
              key={f.key}
              style={[
                styles.filterChip,
                { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
                active && { backgroundColor: theme.colors.primaryLight, borderColor: theme.colors.primaryLight },
              ]}
              onPress={() => setFilter(f.key)}
            >
              <Ionicons name={f.icon as any} size={13} color={active ? '#fff' : theme.colors.textMuted} />
              <Text style={[styles.filterText, { color: active ? '#fff' : theme.colors.textSecondary },
                active && { fontFamily: 'Poppins_700Bold' }]}>
                {f.label}
              </Text>
            </Pressable>
          );
        })}
      </Animated.View>

      {/* List */}
      {isLoading ? (
        <View style={{ padding: 20, gap: 12 }}>
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} width="100%" height={130} style={{ borderRadius: 16 }} />
          ))}
        </View>
      ) : filtered.length === 0 ? (
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <EmptyState
            icon="football-outline"
            title={filter === 'open' ? 'Sin jornadas activas' : filter === 'finished' ? 'Sin finalizadas' : 'Sin jornadas'}
            description="Las jornadas aparecerán aquí cuando el admin las cree"
          />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item?.id ?? String(Math.random())}
          renderItem={({ item, index }) => (
            <Animated.View entering={FadeInDown.delay(index * 70).duration(360).springify()}>
              <MatchdayCard
                item={item}
                ticketCount={ticketsByMatchday[item?.id] ?? 0}
                myTickets={myTickets ?? []}
                theme={theme}
              />
            </Animated.View>
          )}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primaryLight} />
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 24, paddingTop: 18, paddingBottom: 10,
  },
  title: {
    fontSize: 26, fontFamily: 'Poppins_800ExtraBold',
    letterSpacing: -0.5,
  },
  subtitle: { fontSize: 13, fontFamily: 'Poppins_400Regular', marginTop: 2 },
  openBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 20, borderWidth: 1,
  },
  openDot: { width: 7, height: 7, borderRadius: 4 },
  openBadgeText: { fontSize: 12, fontFamily: 'Poppins_600SemiBold' },

  filterRow: {
    flexDirection: 'row', paddingHorizontal: 20, paddingBottom: 10, gap: 8,
  },
  filterChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 20, borderWidth: 1,
  },
  filterText: { fontSize: 12, fontFamily: 'Poppins_500Medium' },

  listContent: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 120, gap: 12 },

  card: {
    borderRadius: 18, borderWidth: 1, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2, shadowRadius: 10, elevation: 5,
  },
  cardTopLine: { height: 2 },
  cardBody: { padding: 16 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardName: { fontSize: 16, fontFamily: 'Poppins_700Bold', letterSpacing: -0.2 },
  cardTournament: { fontSize: 12, fontFamily: 'Poppins_400Regular', marginTop: 2 },

  cardStats: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: 12 },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statText: { fontSize: 12, fontFamily: 'Poppins_400Regular' },

  cardBottom: { marginTop: 12, alignItems: 'flex-start' },
  ticketBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: 'rgba(255,215,0,0.10)',
    borderWidth: 1, borderColor: 'rgba(255,215,0,0.3)',
  },
  ticketBadgeText: { fontSize: 12, fontFamily: 'Poppins_600SemiBold', color: '#FFD700' },
  ctaGrad: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 16, paddingVertical: 8,
    borderRadius: 20, overflow: 'hidden',
  },
  ctaText: { fontSize: 12, fontFamily: 'Poppins_700Bold', color: '#fff' },
  closedText: { fontSize: 12, fontFamily: 'Poppins_400Regular' },
});
