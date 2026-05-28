/**
 * Grupos — Premium group betting list
 * Same premium card style as Quinielas
 */
import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList,
  RefreshControl, Pressable,
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
import api from '../../services/api';

type FilterType = 'all' | 'open' | 'finished';

interface GroupItem {
  id: string; name: string; status: string;
  total_pool: number; team_ids: string[];
  has_third_place: boolean;
  tournament?: { id: string; name: string };
}

function formatCurrency(amount: number) {
  return `Bs ${Number(amount ?? 0).toFixed(2)}`;
}

function GroupCard({
  item, betCount, myBets, theme,
}: { item: GroupItem; betCount: number; myBets: any[]; theme: any }) {
  const isOpen     = item?.status === 'open';
  const teamCount  = item?.team_ids?.length ?? 0;

  const handlePress = () => {
    if (isOpen || betCount > 0) router.push(`/grupo/${item?.id}` as any);
  };

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, opacity: pressed ? 0.85 : 1 },
      ]}
    >
      <LinearGradient
        colors={isOpen
          ? ['#8B0014', '#C8102E']
          : [theme.colors.border, theme.colors.border]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
        style={styles.cardTopLine}
      />
      <View style={styles.cardBody}>
        <View style={styles.cardHeader}>
          <View style={{ flex: 1, marginRight: 10 }}>
            <Text style={[styles.cardName, { color: theme.colors.textPrimary }]} numberOfLines={1}>
              {item?.name ?? 'Grupo'}
            </Text>
            <Text style={[styles.cardTournament, { color: theme.colors.textSecondary }]} numberOfLines={1}>
              {item?.tournament?.name ?? 'Torneo'}
            </Text>
          </View>
          <Badge status={item?.status as any ?? 'pending'} />
        </View>

        <View style={styles.cardStats}>
          <View style={styles.stat}>
            <Ionicons name="people-outline" size={13} color={theme.colors.textMuted} />
            <Text style={[styles.statText, { color: theme.colors.textMuted }]}>{teamCount} equipos</Text>
          </View>
          <View style={styles.stat}>
            <Ionicons name="cash-outline" size={13} color="#10B981" />
            <Text style={[styles.statText, { color: '#10B981', fontFamily: 'Poppins_600SemiBold' }]}>
              {formatCurrency(item?.total_pool ?? 0)}
            </Text>
          </View>
          {item?.has_third_place && (
            <View style={styles.stat}>
              <Ionicons name="podium-outline" size={13} color="#F59E0B" />
              <Text style={[styles.statText, { color: '#F59E0B' }]}>3er lugar</Text>
            </View>
          )}
        </View>

        <View style={styles.cardBottom}>
          {betCount > 0 ? (
            <View style={styles.betBadge}>
              <Ionicons name="checkmark-circle" size={13} color="#10B981" />
              <Text style={styles.betBadgeText}>{betCount} apuesta{betCount > 1 ? 's' : ''}</Text>
            </View>
          ) : isOpen ? (
            <LinearGradient
              colors={['#8B0014', '#C8102E']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={styles.ctaGrad}
            >
              <Text style={styles.ctaText}>¡Apostar!</Text>
              <Ionicons name="arrow-forward" size={13} color="#fff" />
            </LinearGradient>
          ) : (
            <Text style={[styles.closedText, { color: theme.colors.textMuted }]}>Finalizado</Text>
          )}
        </View>
      </View>
    </Pressable>
  );
}

export default function GruposScreen() {
  const [filter, setFilter]         = useState<FilterType>('all');
  const { theme }                   = useTheme();
  const [refreshing, setRefreshing] = useState(false);

  const { data: groups, isLoading, refetch } = useQuery({
    queryKey: ['user-groups'],
    queryFn: async () => {
      try { const res = await api.get('/api/groups'); return (res?.data ?? []) as GroupItem[]; }
      catch { return [] as GroupItem[]; }
    },
  });

  const { data: myBets, refetch: refetchBets } = useQuery({
    queryKey: ['my-group-bets'],
    queryFn: async () => {
      try { const res = await api.get('/api/group-bets/me'); return res?.data ?? []; }
      catch { return []; }
    },
  });

  useFocusEffect(useCallback(() => { refetch(); refetchBets(); }, []));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refetch(), refetchBets()]);
    setRefreshing(false);
  }, [refetch, refetchBets]);

  const betsByGroup: Record<string, number> = {};
  (myBets ?? []).forEach((b: any) => {
    const gid = b?.group_id ?? '';
    if (gid) betsByGroup[gid] = (betsByGroup[gid] ?? 0) + 1;
  });

  const filtered = (groups ?? []).filter((g: GroupItem) => {
    if (filter === 'open') return g?.status === 'open';
    if (filter === 'finished') return g?.status === 'resolved' || g?.status === 'finished';
    return true;
  });

  const openCount = (groups ?? []).filter((g: GroupItem) => g?.status === 'open').length;

  const FILTERS: { key: FilterType; label: string; icon: string }[] = [
    { key: 'all',      label: 'Todos',      icon: 'list-outline'             },
    { key: 'open',     label: 'Activos',    icon: 'flash-outline'            },
    { key: 'finished', label: 'Finalizados', icon: 'checkmark-circle-outline' },
  ];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.bg }]} edges={['top']}>
      <Animated.View entering={FadeIn.duration(350)}>
        <LinearGradient
          colors={[theme.colors.primary, theme.colors.primaryLight]}
          start={{ x: 0, y: 0 }} end={{ x: 0.7, y: 1 }}
          style={styles.headerGrad}
        >
          <View style={styles.headerRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.headerTitle}>Grupos</Text>
              <Text style={styles.headerSubtitle}>
                Apuesta por posiciones de grupo
              </Text>
            </View>
            {openCount > 0 && (
              <View style={[styles.openBadge, { backgroundColor: 'rgba(255,255,255,0.12)', borderColor: 'rgba(255,255,255,0.20)' }]}>
                <View style={[styles.openDot, { backgroundColor: 'rgba(255,255,255,0.85)' }]} />
                <Text style={[styles.openBadgeText, { color: 'rgba(255,255,255,0.85)' }]}>
                  {openCount} activo{openCount > 1 ? 's' : ''}
                </Text>
              </View>
            )}
          </View>
        </LinearGradient>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(60).duration(300)} style={styles.filterRow}>
        {FILTERS.map((f) => {
          const active = filter === f.key;
          return (
            <Pressable
              key={f.key}
              style={[
                styles.filterChip,
                { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
                active && { backgroundColor: '#C8102E', borderColor: '#C8102E' },
              ]}
              onPress={() => setFilter(f.key)}
            >
              <Ionicons name={f.icon as any} size={13} color={active ? '#fff' : theme.colors.textMuted} />
              <Text style={[
                styles.filterText,
                { color: active ? '#fff' : theme.colors.textSecondary },
                active && { fontFamily: 'Poppins_700Bold' },
              ]}>
                {f.label}
              </Text>
            </Pressable>
          );
        })}
      </Animated.View>

      {isLoading ? (
        <View style={{ padding: 20, gap: 12 }}>
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} width="100%" height={130} style={{ borderRadius: 16 }} />
          ))}
        </View>
      ) : filtered.length === 0 ? (
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <EmptyState
            icon="trophy-outline"
            title={filter === 'open' ? 'Sin grupos activos' : filter === 'finished' ? 'Sin finalizados' : 'Sin grupos'}
            description="Los grupos aparecerán aquí cuando el admin los cree"
          />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item?.id ?? String(Math.random())}
          renderItem={({ item, index }) => (
            <Animated.View entering={FadeInDown.delay(index * 70).duration(360).springify()}>
              <GroupCard
                item={item}
                betCount={betsByGroup[item?.id] ?? 0}
                myBets={myBets ?? []}
                theme={theme}
              />
            </Animated.View>
          )}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#C8102E" />
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerGrad: { paddingBottom: 18 },
  headerRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 14,
  },
  headerTitle: { fontSize: 24, fontFamily: 'Poppins_800ExtraBold', color: '#fff', letterSpacing: -0.5 },
  headerSubtitle: { fontSize: 13, fontFamily: 'Poppins_400Regular', color: 'rgba(255,255,255,0.6)', marginTop: 2 },
  openBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 20, borderWidth: 1,
  },
  openDot: { width: 7, height: 7, borderRadius: 4 },
  openBadgeText: { fontSize: 12, fontFamily: 'Poppins_600SemiBold' },
  filterRow: { flexDirection: 'row', paddingHorizontal: 20, paddingBottom: 10, gap: 8 },
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
  betBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: 'rgba(16,185,129,0.10)',
    borderWidth: 1, borderColor: 'rgba(16,185,129,0.3)',
  },
  betBadgeText: { fontSize: 12, fontFamily: 'Poppins_600SemiBold', color: '#10B981' },
  ctaGrad: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 16, paddingVertical: 8,
    borderRadius: 20, overflow: 'hidden',
  },
  ctaText: { fontSize: 12, fontFamily: 'Poppins_700Bold', color: '#fff' },
  closedText: { fontSize: 12, fontFamily: 'Poppins_400Regular' },
});
