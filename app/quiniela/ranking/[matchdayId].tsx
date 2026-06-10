/**
 * Ranking — Per-jornada + tournament-wide pivot
 * Tab 1: This matchday's leaderboard (medal-colored cards)
 * Tab 2: Tournament pivot (J1, J2, ... JN matrix with per-jornada winner highlights)
 */
import React, { useCallback, useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, ScrollView, useWindowDimensions,
  Pressable, RefreshControl, Platform,
} from 'react-native';
import { SafeAreaView }   from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons }       from '@expo/vector-icons';
import { useQuery }       from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { safeGoBack }     from '../../../utils/navigation';
import { router } from 'expo-router';
import Animated, {
  FadeIn, FadeInDown,
  useSharedValue, useAnimatedStyle, withTiming, Easing,
} from 'react-native-reanimated';
import { Skeleton }   from '../../../components/ui/Skeleton';
import { EmptyState } from '../../../components/ui/EmptyState';
import { useAuthStore } from '../../../store/authStore';
import { useTheme }    from '../../../contexts/ThemeContext';
import api from '../../../services/api';
import { parseBackendDate } from '../../../utils/date';
import { formatMoney } from '../../../utils/currency';

// Use formatMoney everywhere: shows integer if exact (Bs 10), 2 decimals if
// fractional (Bs 7.50). Keeps every screen consistent.
function formatCurrency(amount: number, currency = 'Bs'): string {
  return formatMoney(amount, currency);
}

// Scroll 2D para la tabla acumulada (N participantes × M jornadas).
// WEB: un solo contenedor con overflow nativo → scrollea horizontal Y vertical
//      a la vez (un ScrollView de un solo eje recortaba el otro → el bug del
//      scroll horizontal que faltaba).
// MÓVIL: ScrollView horizontal; el scroll vertical lo maneja el ScrollView de
//        la pantalla que envuelve todo el pivot.
function Pivot2DScroll({ maxHeight, children }: { maxHeight: number; children: React.ReactNode }) {
  if (Platform.OS === 'web') {
    return <View style={{ maxHeight, overflow: 'scroll' as any }}>{children}</View>;
  }
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} nestedScrollEnabled bounces={false}>
      {children}
    </ScrollView>
  );
}

interface RankingEntry {
  position: number; user_id: string; username: string; full_name: string;
  total_correct: number; amount_bet: number; prize_won: number; status: string;
}

type TabKey = 'matchday' | 'tournament';

// ─── Race Lanes ───────────────────────────────────────────────────────────────
// Fun horse race visualization. Each user is a horse in a lane, positioned
// horizontally based on their relative score (money or aciertos). The user
// at the top is the leader. Animates smoothly when data changes.
const RACE_EMOJIS = ['🏇', '🐎', '🦄', '🐴', '🚀', '🏃', '🏃‍♀️', '🏃‍♂️'];
function emojiFor(uid: string, idx: number) {
  if (idx === 0) return '🏇'; // leader always jockey
  // Pick a stable emoji per user
  let h = 0;
  for (let i = 0; i < (uid?.length ?? 0); i++) h = (h * 31 + uid.charCodeAt(i)) | 0;
  return RACE_EMOJIS[Math.abs(h) % RACE_EMOJIS.length];
}

function RaceLanes({
  rows, metric, currency, theme, meId,
}: {
  rows: any[]; metric: 'aciertos' | 'dinero'; currency: string; theme: any; meId?: string;
}) {
  // Sort by chosen metric (money when 'dinero', aciertos when 'aciertos')
  const sorted = useMemo(() => {
    const arr = [...(rows ?? [])];
    const getVal = (u: any) => metric === 'dinero'
      ? Number(u?.totalPrize ?? 0)
      : Number(u?.totalCorrect ?? 0);
    return arr.sort((a, b) =>
      getVal(b) - getVal(a) ||
      String(a?.full_name ?? '').localeCompare(String(b?.full_name ?? ''), 'es'),
    );
  }, [rows, metric]);

  const max = useMemo(() => {
    const getVal = (u: any) => metric === 'dinero'
      ? Number(u?.totalPrize ?? 0)
      : Number(u?.totalCorrect ?? 0);
    let m = 0;
    for (const u of sorted) {
      const v = getVal(u);
      if (v > m) m = v;
    }
    return m;
  }, [sorted, metric]);

  const [collapsed, setCollapsed] = useState(false);

  if (!sorted.length) return null;

  const top = sorted[0];
  const topVal = metric === 'dinero' ? Number(top?.totalPrize ?? 0) : Number(top?.totalCorrect ?? 0);
  const hasAnyProgress = max > 0;

  return (
    <View style={[raceStyles.wrap, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
      <LinearGradient
        colors={['#FFD700', '#FFA500', 'transparent']}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
        style={{ height: 2 }}
      />
      <Pressable
        onPress={() => setCollapsed(c => !c)}
        style={raceStyles.head}
      >
        <View style={[raceStyles.headIcon, { backgroundColor: '#FFD70025' }]}>
          <Text style={{ fontSize: 18 }}>🏆</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[raceStyles.title, { color: theme.colors.textPrimary }]}>
            La Carrera del Torneo
          </Text>
          <Text style={[raceStyles.sub, { color: theme.colors.textMuted }]} numberOfLines={1}>
            {hasAnyProgress
              ? `Lidera ${top?.full_name ?? top?.username ?? '?'} con ${metric === 'dinero' ? `${currency} ${formatMoney(topVal, '').trim()}` : `${topVal} aciertos`}`
              : 'Esperando los primeros resultados…'}
          </Text>
        </View>
        <Ionicons
          name={collapsed ? 'chevron-down' : 'chevron-up'}
          size={18}
          color={theme.colors.textMuted}
        />
      </Pressable>

      {!collapsed && (
        <View style={raceStyles.lanes}>
          {/* Finish line indicator */}
          <View style={raceStyles.finishCol} pointerEvents="none">
            <LinearGradient
              colors={['#FFD70000', '#FFD70080', '#FFD700']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={raceStyles.finishGrad}
            />
            <Text style={raceStyles.finishFlag}>🏁</Text>
          </View>

          {sorted.map((u, i) => {
            const val = metric === 'dinero' ? Number(u?.totalPrize ?? 0) : Number(u?.totalCorrect ?? 0);
            // Pct: where this horse sits along the track (0..1)
            const pct = max > 0 ? Math.max(0.04, val / max) : 0.04;
            const isMe = u.uid === meId;
            const isLeader = i === 0 && val > 0;
            return (
              <RaceLane
                key={u.uid}
                index={i}
                username={u.full_name ?? u.username ?? '?'}
                emoji={emojiFor(u.uid, i)}
                pct={pct}
                val={val}
                metric={metric}
                currency={currency}
                isMe={isMe}
                isLeader={isLeader}
                theme={theme}
              />
            );
          })}
        </View>
      )}
    </View>
  );
}

function RaceLane({
  index, username, emoji, pct, val, metric, currency, isMe, isLeader, theme,
}: {
  index: number; username: string; emoji: string; pct: number; val: number;
  metric: 'aciertos' | 'dinero'; currency: string; isMe: boolean; isLeader: boolean; theme: any;
}) {
  // Animated horse position
  const progress = useSharedValue(0);
  React.useEffect(() => {
    progress.value = withTiming(pct, { duration: 900, easing: Easing.out(Easing.cubic) });
  }, [pct, progress]);
  const horseStyle = useAnimatedStyle(() => ({
    left: `${Math.min(95, progress.value * 92)}%`,
  }));

  const laneBg = index % 2 === 0
    ? theme.colors.surfaceElevated
    : theme.colors.surface;

  return (
    <Animated.View
      entering={FadeInDown.delay(index * 50).duration(320)}
      style={[
        raceStyles.lane,
        { backgroundColor: laneBg, borderBottomColor: theme.colors.border },
        isMe && { borderLeftWidth: 3, borderLeftColor: theme.colors.primaryLight },
        isLeader && { backgroundColor: '#FFD70014' },
      ]}
    >
      {/* Lane number / position */}
      <View style={[
        raceStyles.posBadge,
        { borderColor: theme.colors.border, backgroundColor: theme.colors.bg },
        isLeader && { borderColor: '#FFD700', backgroundColor: '#FFD70025' },
      ]}>
        <Text style={[
          raceStyles.posText,
          { color: isLeader ? '#B8860B' : theme.colors.textMuted },
        ]}>
          {index + 1}
        </Text>
      </View>

      {/* Track */}
      <View style={[raceStyles.track, { backgroundColor: theme.colors.bg }]}>
        {/* Dashed lane line */}
        <View style={[raceStyles.trackLine, { borderTopColor: theme.colors.border }]} />
        {/* Horse */}
        <Animated.View style={[raceStyles.horse, horseStyle]}>
          <Text style={raceStyles.horseEmoji}>{emoji}</Text>
        </Animated.View>
      </View>

      {/* Name + value */}
      <View style={raceStyles.info}>
        <Text style={[
          raceStyles.name,
          { color: theme.colors.textPrimary },
          isMe && { color: theme.colors.primaryLight, fontFamily: 'Poppins_700Bold' },
        ]} numberOfLines={1}>
          {username}{isMe ? ' · TÚ' : ''}
        </Text>
        <Text style={[
          raceStyles.value,
          { color: isLeader ? '#B8860B' : (metric === 'dinero' ? '#10B981' : theme.colors.textSecondary) },
        ]}>
          {metric === 'dinero'
            ? (val > 0 ? `${currency} ${formatMoney(val, '').trim()}` : '—')
            : `${val} pts`}
        </Text>
      </View>
    </Animated.View>
  );
}

const raceStyles = StyleSheet.create({
  wrap: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
  },
  headIcon: {
    width: 34, height: 34, borderRadius: 17,
    alignItems: 'center', justifyContent: 'center',
  },
  title: {
    fontSize: 14,
    fontFamily: 'Poppins_700Bold',
    letterSpacing: -0.2,
  },
  sub: {
    fontSize: 11,
    fontFamily: 'Poppins_400Regular',
    marginTop: 1,
  },
  lanes: {
    position: 'relative',
  },
  finishCol: {
    position: 'absolute',
    right: 78, // leaves room for the info column
    top: 0,
    bottom: 0,
    width: 22,
    alignItems: 'center',
    zIndex: 0,
  },
  finishGrad: {
    position: 'absolute',
    right: 8,
    top: 0,
    bottom: 0,
    width: 14,
  },
  finishFlag: {
    fontSize: 14,
    position: 'absolute',
    top: 4,
    right: 2,
  },
  lane: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    minHeight: 44,
  },
  posBadge: {
    width: 22, height: 22, borderRadius: 11,
    borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  posText: {
    fontSize: 11,
    fontFamily: 'Poppins_700Bold',
  },
  track: {
    flex: 1,
    height: 26,
    borderRadius: 13,
    position: 'relative',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  trackLine: {
    position: 'absolute',
    left: 6,
    right: 6,
    top: '50%',
    borderTopWidth: 1,
    borderStyle: 'dashed',
  },
  horse: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  horseEmoji: {
    fontSize: 18,
  },
  info: {
    width: 86,
    alignItems: 'flex-end',
  },
  name: {
    fontSize: 11,
    fontFamily: 'Poppins_600SemiBold',
    maxWidth: 86,
  },
  value: {
    fontSize: 11,
    fontFamily: 'Poppins_700Bold',
    marginTop: 1,
  },
});

export default function RankingScreen() {
  const { theme }  = useTheme();
  const { matchdayId = '' } = useLocalSearchParams<{ matchdayId: string }>();
  const { user }   = useAuthStore();
  const { height: winH } = useWindowDimensions();
  // Altura máx del cuerpo de la tabla acumulada → scroll vertical propio.
  // (En web el ScrollView horizontal recorta el overflow vertical, por eso las
  // filas no scrolleaban; con un ScrollView acotado adentro anda en app Y web.)
  const pivotRowsMaxH = Math.max(260, winH - 340);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<TabKey>('matchday');
  // Pivot cell view: 'aciertos' or 'dinero'. Default auto-set below based on whether
  // the tournament's matchdays are fully resolved (then dinero) or still in progress
  // (then aciertos). The user can still toggle manually.
  const [cellView, setCellView] = useState<'aciertos' | 'dinero'>('aciertos');
  // Track whether the user manually toggled — once they did, don't auto-flip
  const [cellViewUserOverride, setCellViewUserOverride] = useState(false);
  // Animated value used to fade cells when toggling view
  const cellFade = useSharedValue(1);
  const cellAnimStyle = useAnimatedStyle(() => ({ opacity: cellFade.value }));
  const toggleCellView = () => {
    setCellViewUserOverride(true);
    // Fade out → swap → fade in
    cellFade.value = withTiming(0, { duration: 140, easing: Easing.out(Easing.cubic) }, () => {
      cellFade.value = withTiming(1, { duration: 220, easing: Easing.out(Easing.cubic) });
    });
    setTimeout(() => setCellView(v => v === 'aciertos' ? 'dinero' : 'aciertos'), 140);
  };

  // ── Per-matchday ranking ────────────────────────────────────────────────────
  const { data: ranking, isLoading: rankLoading, refetch: refetchRank } = useQuery({
    queryKey: ['ranking', matchdayId],
    queryFn: async () => {
      if (!matchdayId) return [];
      const res = await api.get(`/api/matchdays/${matchdayId}/ranking`);
      return (res?.data ?? []) as RankingEntry[];
    },
    enabled: !!matchdayId,
    refetchOnMount: 'always',
  });

  const { data: matchday } = useQuery({
    queryKey: ['matchday-info', matchdayId],
    queryFn: async () => {
      if (!matchdayId) return null;
      const res = await api.get(`/api/matchdays/${matchdayId}`);
      return res?.data ?? null;
    },
    enabled: !!matchdayId,
  });

  const routeTournamentId = (useLocalSearchParams<{ tournamentId?: string }>().tournamentId) || undefined;
  // tournamentId del param de ruta si vino; sino, del matchday (cadena). Tener
  // el param directo evita que el acumulado quede vacío en la 1ª visita mientras
  // carga matchday-info (era el "no muestra nada hasta volver atrás").
  const tournamentId: string | undefined = routeTournamentId ?? matchday?.tournament_id ?? matchday?.tournament?.id;
  const currency = matchday?.tournament?.currency ?? 'Bs';

  // ── Tournament-wide accumulated pivot ────────────────────────────────────────
  const { data: accumulated, isLoading: accLoading, refetch: refetchAcc } = useQuery({
    queryKey: ['tournament-accumulated', tournamentId],
    queryFn: async () => {
      if (!tournamentId) return null;
      const res = await api.get(`/api/reports/tournament/${tournamentId}/accumulated`);
      return res?.data ?? null;
    },
    enabled: !!tournamentId && tab === 'tournament',
    refetchOnMount: 'always',
  });

  // ── My personal ticket history (own picks per jornada) ──────────────────────
  const { data: myTickets, refetch: refetchMyTickets } = useQuery({
    queryKey: ['my-tickets-for-tournament-ranking', user?.id],
    queryFn: async () => {
      try { const res = await api.get('/api/tickets/me'); return res?.data ?? []; }
      catch { return []; }
    },
    enabled: !!user?.id && tab === 'tournament',
  });

  // Auto-set cellView based on tournament resolution status:
  //   - All matchdays resolved → "dinero" (money is the relevant info)
  //   - Any unresolved → "aciertos" (live tracking is more useful)
  // Only auto-changes if the user hasn't manually toggled.
  React.useEffect(() => {
    if (cellViewUserOverride) return;
    const mds = accumulated?.matchdays ?? [];
    if (mds.length === 0) return;
    const allResolved = mds.every((m: any) => m?.status === 'resolved' || m?.status === 'finished');
    setCellView(allResolved ? 'dinero' : 'aciertos');
  }, [accumulated?.matchdays, cellViewUserOverride]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refetchRank(), refetchAcc(), refetchMyTickets()]);
    setRefreshing(false);
  }, [refetchRank, refetchAcc, refetchMyTickets]);

  // Auto-refresh whenever this screen comes into focus (user navigates back from
  // another screen). Keeps numbers in sync without manual pull-to-refresh.
  useFocusEffect(useCallback(() => {
    refetchRank();
    refetchAcc();
    refetchMyTickets();
  }, [refetchRank, refetchAcc, refetchMyTickets]));

  // Map matchday_id → ticket for THIS tournament's matchdays only
  const myTicketByMatchday = useMemo(() => {
    const m = new Map<string, any>();
    const mdIds = new Set((accumulated?.matchdays ?? []).map((md: any) => md.id));
    for (const t of (myTickets ?? [])) {
      if (mdIds.has(t?.matchday_id) && Number(t?.amount_bet ?? 0) > 0) {
        m.set(t.matchday_id, t);
      }
    }
    return m;
  }, [myTickets, accumulated]);

  const getMedalEmoji = (pos: number) => {
    if (pos === 1) return '🥇';
    if (pos === 2) return '🥈';
    if (pos === 3) return '🥉';
    return null;
  };

  const getTopLineColors = (pos: number): [string, string, string] => {
    if (pos === 1) return ['#FFD700', '#FFA500', 'transparent'];
    if (pos === 2) return ['#C0C0C0', '#A0A0A0', 'transparent'];
    if (pos === 3) return ['#CD7F32', '#A0522D', 'transparent'];
    return [theme.colors.border, theme.colors.border, theme.colors.border];
  };

  const getPosColor = (pos: number) => {
    if (pos === 1) return '#FFD700';
    if (pos === 2) return '#C0C0C0';
    if (pos === 3) return '#CD7F32';
    return theme.colors.textSecondary;
  };

  // ── Per-jornada winner detection (for pivot cell highlighting) ──────────────
  // For each matchday, find max aciertos across all users — those who hit it are winners.
  const maxByMatchday = useMemo(() => {
    const m = new Map<string, number>();
    if (!accumulated?.matchdays || !accumulated?.ranking) return m;
    for (const md of accumulated.matchdays) {
      let max = 0;
      for (const u of accumulated.ranking) {
        const v = u.perMatchday?.[md.id];
        if (typeof v === 'number' && v > max) max = v;
      }
      if (max > 0) m.set(md.id, max);
    }
    return m;
  }, [accumulated]);

  // ── Per-jornada actual pozo (users who bet × bet) — used in tooltips/hints
  const pozoByMd = useMemo(() => {
    const m = new Map<string, number>();
    if (!accumulated?.matchdays || !accumulated?.ranking) return m;
    const bet = Number(accumulated?.tournament?.bet_per_matchday ?? 0);
    for (const md of accumulated.matchdays) {
      const bettors = accumulated.ranking
        .filter((u: any) => typeof u.perMatchday?.[md.id] === 'number').length;
      m.set(md.id, bettors * bet);
    }
    return m;
  }, [accumulated]);

  // ── Group ranking entries by total_correct so ties share a position ──────────
  // E.g. 3 users with 5 correct → all "1st place" (🥇), next user is "4th".
  const rankingByPosition = useMemo(() => {
    const rows = ranking ?? [];
    if (rows.length === 0) return [] as Array<RankingEntry & { sharedPosition: number; tied: boolean; hasWon: boolean }>;
    // Sort by total_correct desc (server might already do this, but be safe)
    const sorted = [...rows].sort((a, b) =>
      (b.total_correct ?? 0) - (a.total_correct ?? 0) ||
      (b.prize_won ?? 0) - (a.prize_won ?? 0) ||
      String(a.full_name ?? '').localeCompare(String(b.full_name ?? ''), 'es'),
    );
    const out: Array<RankingEntry & { sharedPosition: number; tied: boolean; hasWon: boolean }> = [];
    let currentPos = 1;
    let lastScore: number | null = null;
    for (let i = 0; i < sorted.length; i++) {
      const s = sorted[i].total_correct ?? 0;
      if (lastScore === null || s !== lastScore) {
        // New score → advance position to (i + 1) so ties are correctly accounted for
        currentPos = i + 1;
        lastScore = s;
      }
      // hasWon = the user actually got at least one match right (they "won" something).
      // If everyone has 0, nobody really competed — don't tag as "Empate".
      out.push({ ...sorted[i], sharedPosition: currentPos, tied: false, hasWon: s > 0 });
    }
    // Mark ties: only meaningful for users with > 0 aciertos
    const counts = new Map<number, number>();
    for (const r of out) {
      if (r.hasWon) counts.set(r.sharedPosition, (counts.get(r.sharedPosition) ?? 0) + 1);
    }
    return out.map(r => ({ ...r, tied: r.hasWon && (counts.get(r.sharedPosition) ?? 0) > 1 }));
  }, [ranking]);

  // ── Per-matchday card renderer (Tab 1) ──────────────────────────────────────
  const renderRankItem = ({ item, index }: { item: RankingEntry & { sharedPosition?: number; tied?: boolean; hasWon?: boolean }; index: number }) => {
    // Use sharedPosition (handles ties) instead of raw position
    const pos     = item?.sharedPosition ?? item?.position ?? index + 1;
    const isMe    = item?.user_id === user?.id;
    const hasWon  = item?.hasWon ?? ((item?.total_correct ?? 0) > 0);
    // Only show medal/podium colors when the user actually got > 0 aciertos.
    // If they got 0, they're not "1st place" — they just didn't compete or didn't hit.
    const medal   = hasWon ? getMedalEmoji(pos) : null;
    const posClr  = hasWon ? getPosColor(pos) : theme.colors.textMuted;
    const topColors: [string, string, string] = hasWon
      ? getTopLineColors(pos)
      : [theme.colors.border, theme.colors.border, theme.colors.border];
    const isTied  = item?.tied;
    const hasTicket = (item?.amount_bet ?? 0) > 0;

    return (
      <Animated.View entering={FadeInDown.delay(index * 50).duration(320).springify()}>
        <View style={[
          styles.rankCard,
          { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
          isMe  && { borderColor: theme.colors.primaryLight + '80' },
          hasWon && pos === 1 && { borderColor: '#FFD70050' },
          hasWon && pos === 2 && { borderColor: '#C0C0C050' },
          hasWon && pos === 3 && { borderColor: '#CD7F3250' },
        ]}>
          <LinearGradient
            colors={topColors}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={{ height: 1.5 }}
          />
          <View style={styles.rankBody}>
            <View style={[styles.posBadge, { borderColor: posClr + '60', backgroundColor: posClr + '12' }]}>
              {medal ? <Text style={styles.medalText}>{medal}</Text>
                     : <Text style={[styles.posNum, { color: posClr }]}>{pos}</Text>}
            </View>
            <View style={styles.userInfo}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={[
                  styles.userName,
                  { color: theme.colors.textPrimary },
                  isMe && { color: theme.colors.primaryLight },
                ]} numberOfLines={1}>
                  {item?.full_name ?? 'Usuario'}{isMe ? ' (Tú)' : ''}
                </Text>
                {/* EMPATE chip only when actually tied AND someone won */}
                {isTied && hasWon && (
                  <View style={[styles.tiedChip, { backgroundColor: posClr + '20', borderColor: posClr + '50' }]}>
                    <Text style={[styles.tiedChipText, { color: posClr }]}>EMPATE</Text>
                  </View>
                )}
                {/* If user didn't bet, mark clearly */}
                {!hasTicket && (
                  <View style={[styles.tiedChip, { backgroundColor: '#EF444418', borderColor: '#EF444450' }]}>
                    <Text style={[styles.tiedChipText, { color: '#EF4444' }]}>NO APOSTÓ</Text>
                  </View>
                )}
              </View>
              {/* Privacidad: solo nombre — sin @usuario */}
            </View>
            <View style={styles.scoreInfo}>
              <Text style={[styles.correctCount, { color: theme.colors.textPrimary }]}>
                {item?.total_correct ?? 0}
                <Text style={[styles.ptsLabel, { color: theme.colors.textMuted }]}> pts</Text>
              </Text>
              {(item?.prize_won ?? 0) > 0 && (
                <Text style={styles.prizeText}>+{formatCurrency(item.prize_won, currency)}</Text>
              )}
            </View>
          </View>
        </View>
      </Animated.View>
    );
  };

  // ── Tournament pivot renderer (Tab 2) ───────────────────────────────────────
  const renderTournamentPivot = () => {
    if (accLoading) {
      return (
        <View style={{ padding: 20, gap: 10 }}>
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} width="100%" height={48} style={{ borderRadius: 10 }} />
          ))}
        </View>
      );
    }

    const matchdays = accumulated?.matchdays ?? [];
    const rows      = accumulated?.ranking ?? [];

    if (rows.length === 0) {
      return (
        <View style={{ flex: 1, justifyContent: 'center', paddingTop: 60 }}>
          <EmptyState
            icon="grid-outline"
            title="Sin datos acumulados"
            description="Aparecerán cuando se jueguen las jornadas"
          />
        </View>
      );
    }

    const cur = accumulated?.tournament?.currency ?? 'Bs';

    const betPerMd = Number(accumulated?.tournament?.bet_per_matchday ?? 0);
    const totalInscritos = rows.length;

    // ── Autosize de la columna PARTICIPANTE ────────────────────────────────
    // La columna era fija (150px) → los nombres largos se cortaban y se
    // encimaban con J1. Ahora el ancho se ajusta al nombre MÁS LARGO del
    // listado (incluye el sufijo " · TÚ"). pivotName = 13px Poppins SemiBold
    // ≈ 8px/caracter. Clamp 150–320px (más allá usa ellipsis). El MISMO ancho
    // se aplica al header y a todas las filas → columnas siempre alineadas.
    const longestNameLen = rows.reduce((m: number, u: any) => {
      const extra = u.uid === user?.id ? 5 : 0; // sufijo " · TÚ"
      return Math.max(m, String(u.full_name ?? u.username ?? '').length + extra);
    }, 'Participante'.length);
    const nameColW = Math.round(Math.min(340, Math.max(150, longestNameLen * 8 + 44)));

    return (
      <View style={styles.pivotWrap}>

        {/* ─── "Cómo Funciona" explainer ────────────────────────────────── */}
        <View style={[styles.infoCard, { backgroundColor: theme.colors.primaryLight + '10', borderColor: theme.colors.primaryLight + '45' }]}>
          <View style={styles.infoCardHead}>
            <Ionicons name="information-circle" size={18} color={theme.colors.primaryLight} />
            <Text style={[styles.infoCardTitle, { color: theme.colors.textPrimary }]}>
              Cómo se reparte el pozo
            </Text>
          </View>
          <View style={styles.infoCardSteps}>
            <View style={styles.infoStep}>
              <View style={[styles.infoStepNum, { backgroundColor: theme.colors.primaryLight }]}>
                <Text style={styles.infoStepNumText}>1</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.infoStepText, { color: theme.colors.textPrimary }]}>
                  Pozo de cada jornada
                </Text>
                <Text style={[styles.infoStepSub, { color: theme.colors.textSecondary }]}>
                  Todos los inscritos aportan al pozo:{' '}
                  <Text style={{ fontFamily: 'Poppins_700Bold', color: theme.colors.primaryLight }}>inscritos</Text>
                  {' × '}
                  <Text style={{ fontFamily: 'Poppins_700Bold', color: theme.colors.primaryLight }}>{cur} {betPerMd}</Text>
                  {' = '}
                  <Text style={{ fontFamily: 'Poppins_700Bold', color: '#10B981' }}>
                    {cur} {(totalInscritos * betPerMd).toFixed(2)}
                  </Text>
                  {' (' + totalInscritos + ' inscritos).'}
                </Text>
              </View>
            </View>
            <View style={styles.infoStep}>
              <View style={[styles.infoStepNum, { backgroundColor: '#FFD700' }]}>
                <Text style={[styles.infoStepNumText, { color: '#7B5A00' }]}>2</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.infoStepText, { color: theme.colors.textPrimary }]}>
                  Ganadores por jornada
                </Text>
                <Text style={[styles.infoStepSub, { color: theme.colors.textSecondary }]}>
                  Quien acertó más partidos en esa jornada se lleva el pozo. Si hay empate, se reparte en partes iguales.
                </Text>
              </View>
            </View>
            <View style={styles.infoStep}>
              <View style={[styles.infoStepNum, { backgroundColor: '#10B981' }]}>
                <Text style={styles.infoStepNumText}>3</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.infoStepText, { color: theme.colors.textPrimary }]}>
                  Total acumulado
                </Text>
                <Text style={[styles.infoStepSub, { color: theme.colors.textSecondary }]}>
                  La columna <Text style={{ fontFamily: 'Poppins_700Bold' }}>"Ganado"</Text> suma todos los premios del torneo. Quien no acierta o no apuesta, no recibe nada.
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Legend */}
        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#FFD700' }]} />
            <Text style={[styles.legendText, { color: theme.colors.textMuted }]}>Ganó la jornada</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: theme.colors.border }]} />
            <Text style={[styles.legendText, { color: theme.colors.textMuted }]}>Sin apostar</Text>
          </View>
        </View>

        {/* ─── 🐎 Race visualization (horse lanes ranked by money/aciertos) ─── */}
        <RaceLanes
          rows={rows}
          metric={cellView}
          currency={cur}
          theme={theme}
          meId={user?.id}
        />

        {/* ─── View toggle: Aciertos ↔ Dinero ──────────────────────────── */}
        <View style={[styles.viewToggleRow, { backgroundColor: theme.colors.surfaceElevated, borderColor: theme.colors.border }]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.viewToggleTitle, { color: theme.colors.textPrimary }]}>
              {cellView === 'aciertos'
                ? 'Mostrando: partidos acertados por jornada'
                : 'Mostrando: dinero ganado por jornada'}
            </Text>
            <Text style={[styles.viewToggleHint, { color: theme.colors.textMuted }]}>
              {cellView === 'aciertos'
                ? 'Cada celda = partidos correctos esa jornada'
                : `Suma los valores para verificar el total. Pozo de cada jornada = (inscritos × ${cur} ${betPerMd})`}
            </Text>
          </View>
          <Pressable
            onPress={toggleCellView}
            style={({ pressed }) => [
              styles.viewToggleBtn,
              {
                backgroundColor: cellView === 'aciertos' ? '#10B981' : theme.colors.primaryLight,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
          >
            <Ionicons
              name={cellView === 'aciertos' ? 'cash' : 'checkmark-circle'}
              size={14}
              color="#fff"
            />
            <Text style={styles.viewToggleBtnText}>
              {cellView === 'aciertos' ? 'Ver dinero' : 'Ver aciertos'}
            </Text>
          </Pressable>
        </View>

        {/* Tabla N participantes × M jornadas con scroll 2D (ver Pivot2DScroll). */}
        <Pivot2DScroll maxHeight={pivotRowsMaxH}>
          <View>
            {/* Header row */}
            <View style={[styles.pivotHeader, { backgroundColor: theme.colors.primary }]}>
              {/* Header convertido a Views: un <Text> con width NO respeta el ancho
                  en react-native-web (flex-shrink lo encoge al contenido) -> el header
                  quedaba angosto y desalineado de las filas. Con Views (mismos wrappers
                  que el body) las columnas quedan idénticas y alineadas. */}
              <View style={[styles.pivotCellWrap, styles.pivotPosCol]}>
                <Text style={[styles.pivotHCell, { color: '#fff' }]}>#</Text>
              </View>
              <View style={[styles.pivotCellWrap, styles.pivotNameCol, { width: nameColW }]}>
                <Text style={[styles.pivotHCell, { color: '#fff', textAlign: 'left' }]}>Participante</Text>
              </View>
              {matchdays.map((md: any, i: number) => (
                <View key={md.id} style={[styles.pivotHCellWrap, styles.pivotMdCol]}>
                  <Text style={[styles.pivotHCell, { color: '#fff' }]}>J{i + 1}</Text>
                  <Text style={[styles.pivotHSubCell, { color: cellView === 'dinero' ? '#10B981' : 'rgba(255,255,255,0.6)' }]}>
                    {cellView === 'aciertos' ? 'aciertos' : cur}
                  </Text>
                </View>
              ))}
              {/* TOTAL aciertos column — commented out per user request.
                  Uncomment to re-enable summary column.
              <Text style={[styles.pivotHCell, styles.pivotTotalCol, { color: '#FFD700' }]}>Total{'\n'}<Text style={styles.pivotHSubCellInline}>aciertos</Text></Text>
              */}
              <View style={[styles.pivotCellWrap, styles.pivotPrizeCol]}>
                <Text style={[styles.pivotHCell, { color: '#FFD700', textAlign: 'center' }]}>Ganado{'\n'}<Text style={styles.pivotHSubCellInline}>{cur}</Text></Text>
              </View>
            </View>

            {/* Body rows */}
            {rows.map((u: any, i: number) => {
              const isMe = u.uid === user?.id;
              const pos  = i + 1;
              const isTop = pos <= 3;
              const medal = getMedalEmoji(pos);
              const rowBg = isTop
                ? (pos === 1 ? '#FFD70014' : pos === 2 ? '#C0C0C014' : '#CD7F3214')
                : (i % 2 === 0 ? theme.colors.surface : theme.colors.surfaceElevated);
              return (
                <Animated.View
                  key={u.uid}
                  entering={FadeInDown.delay(i * 30).duration(280)}
                  style={[
                    styles.pivotRow,
                    { backgroundColor: rowBg, borderBottomColor: theme.colors.border },
                    isMe && { borderLeftWidth: 3, borderLeftColor: theme.colors.primaryLight },
                  ]}
                >
                  {/* Position */}
                  <View style={[styles.pivotCellWrap, styles.pivotPosCol]}>
                    {medal ? (
                      <Text style={styles.pivotMedal}>{medal}</Text>
                    ) : (
                      <Text style={[styles.pivotPosNum, { color: theme.colors.textMuted }]}>{pos}</Text>
                    )}
                  </View>
                  {/* Name */}
                  <View style={[styles.pivotCellWrap, styles.pivotNameCol, { width: nameColW }]}>
                    <Text style={[
                      styles.pivotName,
                      { color: theme.colors.textPrimary },
                      isMe && { color: theme.colors.primaryLight, fontFamily: 'Poppins_700Bold' },
                    ]} numberOfLines={1}>
                      {u.full_name}{isMe ? ' · TÚ' : ''}
                    </Text>
                    {/* Privacidad: solo nombre — sin @usuario */}
                  </View>
                  {/* Per-matchday cells (toggle: aciertos ↔ dinero) */}
                  {matchdays.map((md: any) => {
                    const val       = u.perMatchday?.[md.id];
                    const maxThisMd = maxByMatchday.get(md.id) ?? 0;
                    const isWinner  = typeof val === 'number' && val === maxThisMd && val > 0;
                    const noPick    = val === undefined || val === null;
                    // Use the REAL prize from each user's ticket (source of truth).
                    // Fall back to 0 if the backend hasn't sent perMatchdayPrize.
                    const prizeMd   = Number(u?.perMatchdayPrize?.[md.id] ?? 0);
                    return (
                      <View
                        key={md.id}
                        style={[
                          styles.pivotCellWrap,
                          styles.pivotMdCol,
                          isWinner && { backgroundColor: '#FFD70028' },
                        ]}
                      >
                        {noPick ? (
                          <Text style={[styles.pivotMissed, { color: theme.colors.textMuted }]}>—</Text>
                        ) : (
                          <Animated.View style={[styles.pivotMdInner, cellAnimStyle]}>
                            {cellView === 'aciertos' ? (
                              <>
                                <Text style={[
                                  styles.pivotMdNum,
                                  { color: isWinner ? '#B8860B' : theme.colors.textPrimary },
                                  isWinner && { fontFamily: 'Poppins_800ExtraBold' },
                                ]}>
                                  {val}
                                </Text>
                                {isWinner && <Text style={styles.pivotMdCrown}>👑</Text>}
                              </>
                            ) : (
                              <>
                                {prizeMd > 0 ? (
                                  <Text style={[
                                    styles.pivotMdMoney,
                                    { color: '#10B981' },
                                  ]}>
                                    +{formatMoney(prizeMd, '').trim()}
                                  </Text>
                                ) : (
                                  <Text style={[styles.pivotMdMoneyZero, { color: theme.colors.textMuted }]}>
                                    0
                                  </Text>
                                )}
                              </>
                            )}
                          </Animated.View>
                        )}
                      </View>
                    );
                  })}
                  {/* Total aciertos column — commented out per user request.
                      Uncomment to re-enable.
                  <View style={[styles.pivotCellWrap, styles.pivotTotalCol, { backgroundColor: theme.colors.primaryLight + '14' }]}>
                    <Text style={[styles.pivotTotalNum, { color: theme.colors.primaryLight }]}>
                      {u.totalCorrect}
                    </Text>
                  </View>
                  */}
                  {/* Prize */}
                  <View style={[styles.pivotCellWrap, styles.pivotPrizeCol]}>
                    <Text style={[
                      styles.pivotPrize,
                      { color: u.totalPrize > 0 ? '#10B981' : theme.colors.textMuted },
                    ]}>
                      {u.totalPrize > 0 ? formatMoney(u.totalPrize, cur) : '—'}
                    </Text>
                  </View>
                </Animated.View>
              );
            })}
          </View>
        </Pivot2DScroll>

        {/* Summary footer */}
        <View style={[styles.pivotFooter, { backgroundColor: theme.colors.surfaceElevated, borderColor: theme.colors.border }]}>
          <View style={styles.footerItem}>
            <Ionicons name="calendar" size={14} color={theme.colors.textMuted} />
            <Text style={[styles.footerText, { color: theme.colors.textSecondary }]}>
              {matchdays.length} jornadas
            </Text>
          </View>
          <View style={styles.footerItem}>
            <Ionicons name="people" size={14} color={theme.colors.textMuted} />
            <Text style={[styles.footerText, { color: theme.colors.textSecondary }]}>
              {rows.length} participantes
            </Text>
          </View>
          <View style={styles.footerItem}>
            <Ionicons name="cash" size={14} color="#10B981" />
            <Text style={[styles.footerText, { color: theme.colors.textSecondary }]}>
              {cur} {accumulated?.tournament?.bet_per_matchday ?? 0}/jornada
            </Text>
          </View>
        </View>

        {/* ─── MI HISTORIAL — private section for the logged-in user ──────── */}
        {user?.id && myTicketByMatchday.size > 0 && (
          <View style={[styles.historySection, { backgroundColor: theme.colors.surface, borderColor: theme.colors.primaryLight + '40' }]}>
            <LinearGradient
              colors={[theme.colors.primaryLight, theme.colors.primary, 'transparent']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={{ height: 2 }}
            />
            <View style={styles.historyHead}>
              <View style={[styles.historyIcon, { backgroundColor: theme.colors.primaryLight + '20' }]}>
                <Ionicons name="person-circle" size={20} color={theme.colors.primaryLight} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.historyTitle, { color: theme.colors.textPrimary }]}>
                  Mi historial
                </Text>
                <Text style={[styles.historySub, { color: theme.colors.textMuted }]}>
                  Tus apuestas en este torneo — solo visible para ti
                </Text>
              </View>
            </View>

            {matchdays.map((md: any, mi: number) => {
              const ticket = myTicketByMatchday.get(md.id);
              const mdDate = parseBackendDate(md.date);
              const dateLabel = mdDate
                ? `${String(mdDate.getDate()).padStart(2, '0')}/${String(mdDate.getMonth() + 1).padStart(2, '0')}/${mdDate.getFullYear()}`
                : '';
              const maxThisMd = maxByMatchday.get(md.id) ?? 0;
              const myCorrect = Number(ticket?.total_correct ?? 0);
              const isWinner  = ticket && myCorrect === maxThisMd && myCorrect > 0;
              const won       = Number(ticket?.prize_won ?? 0);

              if (!ticket) {
                // I didn't bet on this jornada
                return (
                  <View key={md.id} style={[styles.historyRow, { borderTopColor: theme.colors.border }]}>
                    <View style={[styles.historyMdNum, { backgroundColor: theme.colors.inputBg, borderColor: theme.colors.border }]}>
                      <Text style={[styles.historyMdNumText, { color: theme.colors.textMuted }]}>J{mi + 1}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.historyMdName, { color: theme.colors.textPrimary }]} numberOfLines={1}>
                        {md.name}
                      </Text>
                      <Text style={[styles.historyMdMeta, { color: theme.colors.textMuted }]}>
                        {dateLabel}
                      </Text>
                    </View>
                    <View style={[styles.historyTag, { backgroundColor: '#EF444412', borderColor: '#EF444440' }]}>
                      <Text style={[styles.historyTagText, { color: '#EF4444' }]}>No apostaste</Text>
                    </View>
                  </View>
                );
              }

              return (
                <Pressable
                  key={md.id}
                  onPress={() => router.push(`/quiniela/ticket/${ticket.id}` as any)}
                  style={({ pressed }) => [
                    styles.historyRow,
                    { borderTopColor: theme.colors.border },
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <View style={[
                    styles.historyMdNum,
                    isWinner
                      ? { backgroundColor: '#FFD70022', borderColor: '#FFD70060' }
                      : { backgroundColor: theme.colors.primaryLight + '18', borderColor: theme.colors.primaryLight + '50' },
                  ]}>
                    <Text style={[
                      styles.historyMdNumText,
                      { color: isWinner ? '#B8860B' : theme.colors.primaryLight },
                    ]}>J{mi + 1}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={[styles.historyMdName, { color: theme.colors.textPrimary }]} numberOfLines={1}>
                        {md.name}
                      </Text>
                      {isWinner && (
                        <View style={[styles.historyWinChip, { backgroundColor: '#FFD70025', borderColor: '#FFD70060' }]}>
                          <Text style={styles.historyWinCrown}>👑</Text>
                          <Text style={[styles.historyWinText, { color: '#B8860B' }]}>GANASTE</Text>
                        </View>
                      )}
                    </View>
                    <Text style={[styles.historyMdMeta, { color: theme.colors.textMuted }]}>
                      {dateLabel} · Apostaste {formatMoney(ticket.amount_bet, cur)}
                    </Text>
                    <View style={styles.historyStatsRow}>
                      <View style={[styles.historyStat, { backgroundColor: '#10B98112', borderColor: '#10B98140' }]}>
                        <Ionicons name="checkmark-circle" size={11} color="#10B981" />
                        <Text style={[styles.historyStatText, { color: '#10B981' }]}>
                          {myCorrect} acierto{myCorrect === 1 ? '' : 's'}
                        </Text>
                      </View>
                      {won > 0 && (
                        <View style={[styles.historyStat, { backgroundColor: '#10B98112', borderColor: '#10B98140' }]}>
                          <Ionicons name="cash" size={11} color="#10B981" />
                          <Text style={[styles.historyStatText, { color: '#10B981' }]}>
                            +{formatMoney(won, cur)}
                          </Text>
                        </View>
                      )}
                      {!isWinner && maxThisMd > myCorrect && (
                        <Text style={[styles.historyMissed, { color: theme.colors.textMuted }]}>
                          Te faltaron {maxThisMd - myCorrect} para ganar
                        </Text>
                      )}
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={theme.colors.textMuted} />
                </Pressable>
              );
            })}

            {/* Personal grand total */}
            <View style={[styles.historyTotal, { backgroundColor: theme.colors.primaryLight + '10', borderTopColor: theme.colors.primaryLight + '40' }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.historyTotalLabel, { color: theme.colors.textMuted }]}>
                  Tu total acumulado
                </Text>
                <Text style={[styles.historyTotalValue, { color: theme.colors.primaryLight }]}>
                  {(() => {
                    const me = rows.find((u: any) => u.uid === user?.id);
                    return me ? `${me.totalCorrect} aciertos` : '—';
                  })()}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[styles.historyTotalLabel, { color: theme.colors.textMuted }]}>
                  Premio total
                </Text>
                <Text style={[styles.historyTotalValue, { color: '#10B981' }]}>
                  {(() => {
                    const me = rows.find((u: any) => u.uid === user?.id);
                    return me ? formatMoney(me.totalPrize ?? 0, cur) : formatMoney(0, cur);
                  })()}
                </Text>
              </View>
            </View>
          </View>
        )}
      </View>
    );
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
              <Text style={styles.headerTitle}>Ranking</Text>
              <Text style={styles.headerSub} numberOfLines={1}>
                {tab === 'matchday' ? (matchday?.name ?? 'Jornada') : (accumulated?.tournament?.name ?? matchday?.tournament?.name ?? 'Torneo')}
              </Text>
            </View>
            <View style={styles.headerIcon}>
              <Ionicons name="podium" size={22} color="#FFD700" />
            </View>
          </View>
        </LinearGradient>
      </Animated.View>

      {/* Tab toggle */}
      <View style={[styles.tabBar, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
        <Pressable
          style={[styles.tab, tab === 'matchday' && { borderBottomColor: theme.colors.primaryLight }]}
          onPress={() => setTab('matchday')}
        >
          <Ionicons
            name="podium"
            size={16}
            color={tab === 'matchday' ? theme.colors.primaryLight : theme.colors.textMuted}
          />
          <Text style={[
            styles.tabText,
            { color: tab === 'matchday' ? theme.colors.primaryLight : theme.colors.textMuted },
          ]}>
            Esta Jornada
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tab, tab === 'tournament' && { borderBottomColor: '#FFD700' }]}
          onPress={() => setTab('tournament')}
        >
          <Ionicons
            name="grid"
            size={16}
            color={tab === 'tournament' ? '#FFD700' : theme.colors.textMuted}
          />
          <Text style={[
            styles.tabText,
            { color: tab === 'tournament' ? '#FFD700' : theme.colors.textMuted },
          ]}>
            Acumulado Torneo
          </Text>
        </Pressable>
      </View>

      {/* Pool info bar (only for matchday tab) */}
      {tab === 'matchday' && (
        <Animated.View
          entering={FadeInDown.duration(300)}
          style={[styles.poolBar, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}
        >
          <Ionicons name="cash-outline" size={14} color="#10B981" />
          <Text style={[styles.poolText, { color: theme.colors.textSecondary }]}>
            Pozo: {formatCurrency(matchday?.expected_pool ?? matchday?.total_pool ?? 0, currency)}
          </Text>
          <View style={[styles.poolDot, { backgroundColor: theme.colors.border }]} />
          <Text style={[styles.poolText, { color: theme.colors.textSecondary }]}>
            {ranking?.length ?? 0} participantes
          </Text>
        </Animated.View>
      )}

      {/* Tab content */}
      {tab === 'matchday' ? (
        rankLoading ? (
          <View style={{ padding: 20, gap: 10 }}>
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} width="100%" height={72} style={{ borderRadius: 14 }} />
            ))}
          </View>
        ) : (ranking?.length ?? 0) === 0 ? (
          <View style={{ flex: 1, justifyContent: 'center' }}>
            <EmptyState
              icon="podium-outline"
              title="Sin participantes aún"
              description="Los rankings aparecerán cuando se realicen apuestas"
            />
          </View>
        ) : (
          <FlatList
            data={rankingByPosition}
            keyExtractor={(item, i) => item?.user_id ?? String(i)}
            renderItem={renderRankItem}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primaryLight} />
            }
          />
        )
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: 80 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primaryLight} />
          }
        >
          {renderTournamentPivot()}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  headerGrad: { paddingBottom: 22 },
  headerRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 14, gap: 12,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.22)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.20)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 22, fontFamily: 'Poppins_800ExtraBold', color: '#fff', letterSpacing: -0.4 },
  headerSub:   { fontSize: 12, fontFamily: 'Poppins_400Regular', color: 'rgba(255,255,255,0.7)', marginTop: 1 },
  headerIcon: {
    width: 42, height: 42, borderRadius: 13,
    backgroundColor: 'rgba(0,0,0,0.22)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center', justifyContent: 'center',
  },

  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  tabText: { fontSize: 13, fontFamily: 'Poppins_700Bold' },

  poolBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  poolText: { fontSize: 12, fontFamily: 'Poppins_400Regular' },
  poolDot:  { width: 4, height: 4, borderRadius: 2 },

  listContent: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 100, gap: 10 },

  rankCard: {
    borderRadius: 14, borderWidth: 1, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15, shadowRadius: 8, elevation: 4,
  },
  rankBody: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 12, gap: 12,
  },
  posBadge: {
    width: 42, height: 42, borderRadius: 21,
    borderWidth: 1.5, alignItems: 'center', justifyContent: 'center',
  },
  medalText: { fontSize: 22 },
  posNum:    { fontSize: 15, fontFamily: 'Poppins_700Bold' },

  userInfo: { flex: 1 },
  userName: { fontSize: 14, fontFamily: 'Poppins_600SemiBold', letterSpacing: -0.1 },
  userHandle: { fontSize: 11, fontFamily: 'Poppins_400Regular', marginTop: 2 },

  scoreInfo:    { alignItems: 'flex-end' },
  correctCount: { fontSize: 18, fontFamily: 'Poppins_700Bold' },
  ptsLabel:     { fontSize: 11, fontFamily: 'Poppins_400Regular' },
  prizeText:    { fontSize: 12, fontFamily: 'Poppins_600SemiBold', color: '#10B981', marginTop: 2 },
  tiedChip: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 999,
    borderWidth: 1,
  },
  tiedChipText: {
    fontSize: 9,
    fontFamily: 'Poppins_700Bold',
    letterSpacing: 0.5,
  },

  // ── Pivot table styles ──────────────────────────────────────────────────────
  pivotWrap: {
    padding: 12,
  },
  legend: {
    flexDirection: 'row',
    gap: 14,
    paddingHorizontal: 4,
    paddingBottom: 8,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot:  { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 11, fontFamily: 'Poppins_400Regular' },

  pivotHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
  },
  pivotHCell: {
    fontSize: 11,
    fontFamily: 'Poppins_700Bold',
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  pivotHCellWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  pivotHSubCell: {
    fontSize: 8,
    fontFamily: 'Poppins_500Medium',
    letterSpacing: 0.3,
    textTransform: 'lowercase' as const,
    marginTop: 1,
  },
  pivotHSubCellInline: {
    fontSize: 8,
    fontFamily: 'Poppins_400Regular',
    letterSpacing: 0.3,
    color: 'rgba(255,215,0,0.7)',
  },
  pivotRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderBottomWidth: StyleSheet.hairlineWidth,
    minHeight: 52,
  },
  pivotCellWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  pivotPosCol:   { width: 40 },
  pivotNameCol:  { width: 150, alignItems: 'flex-start', justifyContent: 'center', paddingLeft: 12, paddingRight: 28 },
  pivotMdCol:    { width: 60 },
  pivotTotalCol: { width: 60 },
  pivotPrizeCol: { width: 78 },

  pivotMedal: { fontSize: 18 },
  pivotPosNum: { fontSize: 12, fontFamily: 'Poppins_700Bold' },

  pivotName:   { fontSize: 13, fontFamily: 'Poppins_600SemiBold' },
  pivotHandle: { fontSize: 10, fontFamily: 'Poppins_400Regular', marginTop: 1 },

  pivotMdInner: { alignItems: 'center', gap: 1 },
  pivotMdNum:   { fontSize: 14, fontFamily: 'Poppins_700Bold' },
  pivotMdCrown: { fontSize: 11, lineHeight: 13 },
  pivotMissed:  { fontSize: 14, fontFamily: 'Poppins_400Regular' },
  pivotMdMoney: {
    fontSize: 12,
    fontFamily: 'Poppins_800ExtraBold',
    letterSpacing: -0.2,
  },
  pivotMdMoneyZero: {
    fontSize: 12,
    fontFamily: 'Poppins_500Medium',
  },

  // ── View toggle (aciertos ↔ dinero) ────────────────────────────────────────
  viewToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    marginBottom: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  viewToggleTitle: {
    fontSize: 12,
    fontFamily: 'Poppins_700Bold',
  },
  viewToggleHint: {
    fontSize: 10,
    fontFamily: 'Poppins_400Regular',
    marginTop: 2,
  },
  viewToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
  },
  viewToggleBtnText: {
    fontSize: 11,
    fontFamily: 'Poppins_700Bold',
    color: '#fff',
  },

  pivotTotalNum: { fontSize: 16, fontFamily: 'Poppins_800ExtraBold' },
  pivotPrize:    { fontSize: 12, fontFamily: 'Poppins_700Bold' },

  pivotFooter: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
    marginTop: 12,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: 'center',
  },
  footerItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  footerText: { fontSize: 11, fontFamily: 'Poppins_500Medium' },

  // ── "Cómo Funciona" info card ──────────────────────────────────────────────
  infoCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    marginBottom: 14,
  },
  infoCardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  infoCardTitle: {
    fontSize: 14,
    fontFamily: 'Poppins_700Bold',
    letterSpacing: -0.2,
  },
  infoCardSteps: { gap: 10 },
  infoStep: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },
  infoStepNum: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoStepNumText: {
    fontSize: 12,
    fontFamily: 'Poppins_800ExtraBold',
    color: '#fff',
  },
  infoStepText: {
    fontSize: 12,
    fontFamily: 'Poppins_700Bold',
    marginBottom: 2,
  },
  infoStepSub: {
    fontSize: 11,
    fontFamily: 'Poppins_400Regular',
    lineHeight: 15,
  },

  // ── Mi Historial section ───────────────────────────────────────────────────
  historySection: {
    marginTop: 16,
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  historyHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
  },
  historyIcon: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  historyTitle: {
    fontSize: 15,
    fontFamily: 'Poppins_700Bold',
    letterSpacing: -0.2,
  },
  historySub: {
    fontSize: 11,
    fontFamily: 'Poppins_400Regular',
    marginTop: 1,
  },

  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  historyMdNum: {
    width: 40, height: 40, borderRadius: 10,
    borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center',
  },
  historyMdNumText: {
    fontSize: 13,
    fontFamily: 'Poppins_800ExtraBold',
  },
  historyMdName: {
    fontSize: 13,
    fontFamily: 'Poppins_700Bold',
  },
  historyMdMeta: {
    fontSize: 11,
    fontFamily: 'Poppins_400Regular',
    marginTop: 1,
  },
  historyStatsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
    marginTop: 5,
  },
  historyStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
    borderWidth: 1,
  },
  historyStatText: {
    fontSize: 10,
    fontFamily: 'Poppins_700Bold',
  },
  historyMissed: {
    fontSize: 10,
    fontFamily: 'Poppins_500Medium',
    fontStyle: 'italic' as const,
  },
  historyWinChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
    borderWidth: 1,
  },
  historyWinCrown: { fontSize: 10 },
  historyWinText: {
    fontSize: 9,
    fontFamily: 'Poppins_800ExtraBold',
    letterSpacing: 0.4,
  },
  historyTag: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  historyTagText: {
    fontSize: 10,
    fontFamily: 'Poppins_700Bold',
    textTransform: 'uppercase' as const,
    letterSpacing: 0.4,
  },

  historyTotal: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderTopWidth: 1,
  },
  historyTotalLabel: {
    fontSize: 10,
    fontFamily: 'Poppins_500Medium',
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  historyTotalValue: {
    fontSize: 16,
    fontFamily: 'Poppins_800ExtraBold',
    marginTop: 2,
  },
});
