/**
 * Bet Log — Premium bet registry screen
 * Shows: (a) users who bet (with per-match-revealed picks) and (b) users
 * who haven't bet yet. Picks reveal per-match as each starts.
 */
import React, { useCallback, useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  RefreshControl, Pressable, TextInput,
} from 'react-native';
import { SafeAreaView }   from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { safeGoBack }     from '../../../utils/navigation';
import { useQuery }       from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons }       from '@expo/vector-icons';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { Skeleton }    from '../../../components/ui/Skeleton';
import { EmptyState }  from '../../../components/ui/EmptyState';
import { TeamFlag }    from '../../../components/ui/TeamFlag';
import { useTheme }    from '../../../contexts/ThemeContext';
import { useAuthStore } from '../../../store/authStore';
import api from '../../../services/api';

// Pick codes the backend may send. Both L/E/V (new) and 1/X/2 (legacy) supported.
const PICK_LABELS_LOCAL    = ['L', '1'];
const PICK_LABELS_DRAW     = ['E', 'X'];
const PICK_LABELS_VISITOR  = ['V', '2'];

// Compute is_correct client-side when backend didn't set it (e.g., result just entered).
// Module-level so it's available everywhere without TDZ issues.
function computeIsCorrect(pickCode: any, matchResult: any): boolean | null {
  if (!matchResult || !pickCode) return null;
  const pickIsL = PICK_LABELS_LOCAL.includes(pickCode);
  const pickIsV = PICK_LABELS_VISITOR.includes(pickCode);
  const pickIsE = PICK_LABELS_DRAW.includes(pickCode);
  const resIsL  = PICK_LABELS_LOCAL.includes(matchResult);
  const resIsV  = PICK_LABELS_VISITOR.includes(matchResult);
  const resIsE  = PICK_LABELS_DRAW.includes(matchResult);
  if (pickIsL && resIsL) return true;
  if (pickIsV && resIsV) return true;
  if (pickIsE && resIsE) return true;
  return false;
}

export default function BetLogScreen() {
  const { theme }           = useTheme();
  const { user }            = useAuthStore();
  const { matchdayId = '' } = useLocalSearchParams<{ matchdayId: string }>();
  const [refreshing, setRefreshing] = useState(false);
  const [showNoBetUsers, setShowNoBetUsers] = useState(true);
  // Per-match expanded state for the "Aciertos por Partido" cards
  const [expandedMatches, setExpandedMatches] = useState<Record<string, boolean>>({});
  const toggleMatch = (id: string) =>
    setExpandedMatches((prev) => ({ ...prev, [id]: !prev[id] }));
  const [expandedBets, setExpandedBets] = useState<Record<string, boolean>>({});
  const toggleBet = (id: string) =>
    setExpandedBets((prev) => ({ ...prev, [id]: !prev[id] }));
  const [userSearch, setUserSearch] = useState('');

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['bet-log', matchdayId],
    queryFn: async () => {
      try {
        const res = await api.get(`/api/matchdays/${matchdayId}/bet-log`);
        return res?.data ?? null;
      } catch { return null; }
    },
    enabled: !!matchdayId,
    refetchInterval: 30000,
  });

  // Pull matchday detail to get tournament_id and match list (with start times for
  // per-match reveal logic).
  const { data: matchday, refetch: refetchMatchday } = useQuery({
    queryKey: ['matchday-detail', matchdayId],
    queryFn: async () => {
      try {
        const res = await api.get(`/api/matchdays/${matchdayId}`);
        return res?.data ?? null;
      } catch { return null; }
    },
    enabled: !!matchdayId,
  });

  const tournamentId: string | undefined = matchday?.tournament_id ?? matchday?.tournament?.id;

  // Fetch all tournament participants so we can compute who hasn't bet yet
  const { data: participants, refetch: refetchParticipants } = useQuery({
    queryKey: ['tournament-participants', tournamentId],
    queryFn: async () => {
      try {
        // /roster = endpoint publico sin PII (solo id/username/full_name de
        // participantes aprobados). El endpoint completo /tournament/:id es
        // admin-only porque expone phone + ci.
        const res = await api.get(`/api/tournament-participants/tournament/${tournamentId}/roster`);
        return res?.data ?? [];
      } catch { return []; }
    },
    enabled: !!tournamentId,
  });

  // Step 1: fetch the current user's tickets for this matchday (list only).
  const { data: myTickets, refetch: refetchMyTickets } = useQuery({
    queryKey: ['my-tickets-for-matchday', matchdayId],
    queryFn: async () => {
      try {
        const res = await api.get(`/api/tickets/me?matchday_id=${matchdayId}`);
        return res?.data ?? [];
      } catch { return []; }
    },
    enabled: !!matchdayId,
  });

  // The user's real ticket (amount_bet > 0)
  const myTicketId = useMemo(() => {
    const t = (myTickets ?? []).find((x: any) => Number(x?.amount_bet ?? 0) > 0);
    return t?.id ?? null;
  }, [myTickets]);

  // Step 2: fetch the FULL ticket detail (with ticket_picks) — this is the only
  // way to get the user's actual pick codes. /api/tickets/me usually returns
  // tickets WITHOUT picks; /api/tickets/{id} returns the relationship.
  const { data: myTicketDetail, refetch: refetchMyTicketDetail } = useQuery({
    queryKey: ['ticket-detail-for-bet-log', myTicketId],
    queryFn: async () => {
      try {
        if (!myTicketId) return null;
        const res = await api.get(`/api/tickets/${myTicketId}`);
        return res?.data ?? null;
      } catch { return null; }
    },
    enabled: !!myTicketId,
  });

  // Build a map of (user_id → picks[]) from data.bets AND my own ticket detail.
  // If bet-log redacted picks for privacy, this surfaces at least the current
  // user's picks so they always see themselves in the right bucket.
  const picksMapByUser = useMemo(() => {
    const m = new Map<string, any[]>();
    for (const bet of (data?.bets ?? [])) {
      const uid = bet?.user_id ?? bet?.id;
      if (uid && bet?.picks?.length > 0) m.set(uid, bet.picks);
    }
    // Augment with my own ticket-detail picks
    const myDetailPicks = myTicketDetail?.ticket_picks
                       ?? myTicketDetail?.picks
                       ?? [];
    if (user?.id && myDetailPicks.length > 0) {
      const existing = m.get(user.id) ?? [];
      if (existing.length === 0) {
        m.set(user.id, myDetailPicks);
      }
    }
    return m;
  }, [data?.bets, myTicketDetail, user?.id]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      refetch(),
      refetchMatchday(),
      refetchParticipants(),
      refetchMyTickets(),
      refetchMyTicketDetail(),
    ]);
    setRefreshing(false);
  }, [refetch, refetchMatchday, refetchParticipants, refetchMyTickets, refetchMyTicketDetail]);

  // Auto-refresh on screen focus so users see latest scores after navigating
  useFocusEffect(useCallback(() => {
    refetch();
    refetchMatchday();
    refetchParticipants();
    refetchMyTickets();
    refetchMyTicketDetail();
  }, [refetch, refetchMatchday, refetchParticipants, refetchMyTickets, refetchMyTicketDetail]));

  // Build maps to resolve a pick → its match start time. We try several keys so we
  // work whether the backend returns match_id, match_date, or just team names.
  const now = Date.now();
  const matchStartById = useMemo(() => {
    const m = new Map<string, number>();
    for (const match of (matchday?.matches ?? [])) {
      if (match?.id && match?.match_date) {
        const t = new Date(match.match_date).getTime();
        if (!isNaN(t)) m.set(match.id, t);
      }
    }
    return m;
  }, [matchday?.matches]);

  // Team-name map: "teamA__teamB" (lowercased) → start time
  const matchStartByTeams = useMemo(() => {
    const m = new Map<string, number>();
    for (const match of (matchday?.matches ?? [])) {
      const a = (match?.team_a?.name ?? match?.team_a ?? '').toString().toLowerCase().trim();
      const b = (match?.team_b?.name ?? match?.team_b ?? '').toString().toLowerCase().trim();
      if (a && b && match?.match_date) {
        const t = new Date(match.match_date).getTime();
        if (!isNaN(t)) m.set(`${a}__${b}`, t);
      }
    }
    return m;
  }, [matchday?.matches]);

  // Helper: has the match this pick belongs to already started?
  const isPickRevealed = useCallback((pick: any): boolean => {
    // 1) Explicit backend signal — most reliable
    if (pick?.match_started === true) return true;
    if (pick?.match_started === false) return false;
    // 2) Pick has its own match_date
    if (pick?.match_date) {
      const t = new Date(pick.match_date).getTime();
      if (!isNaN(t)) return t <= now;
    }
    // 3) Look up via match_id in matchday's matches
    if (pick?.match_id) {
      const t = matchStartById.get(pick.match_id);
      if (typeof t === 'number') return t <= now;
    }
    // 4) Match by team names (last resort)
    const a = (pick?.team_a ?? '').toString().toLowerCase().trim();
    const b = (pick?.team_b ?? '').toString().toLowerCase().trim();
    if (a && b) {
      const t = matchStartByTeams.get(`${a}__${b}`);
      if (typeof t === 'number') return t <= now;
    }
    // 5) Fallback: legacy "all or nothing" flag from backend
    return data?.reveal_picks === true;
  }, [matchStartById, matchStartByTeams, now, data?.reveal_picks]);

  // Cross-reference participants vs bets to find who DIDN'T bet
  const nonBettors = useMemo(() => {
    if (!participants || !data?.bets) return [];
    const bettorIds = new Set((data.bets ?? []).map((b: any) => b?.user_id ?? b?.id));
    return (participants ?? [])
      .filter((p: any) => p?.status === 'approved')
      .filter((p: any) => !bettorIds.has(p?.user_id ?? p?.user?.id))
      .map((p: any) => ({
        user_id:  p?.user_id ?? p?.user?.id,
        username: p?.user?.username ?? p?.username ?? '-',
        full_name: p?.user?.full_name ?? p?.full_name ?? '-',
      }))
      // Orden alfabético por nombre (igual que la matriz de arriba)
      .sort((a: any, b: any) =>
        String(a.full_name ?? a.username ?? '').localeCompare(
          String(b.full_name ?? b.username ?? ''), 'es',
        ),
      );
  }, [participants, data?.bets]);

  // Enrich each bet with running stats (correct / wrong / pending) — works in
  // real time as matches resolve, even before the matchday is fully resolved.
  // Computes is_correct client-side when backend hasn't set it yet.
  const betsWithStats = useMemo(() => {
    const bets   = data?.bets ?? [];
    const matchList = matchday?.matches ?? [];
    // Build match_id → result and teamPair → result lookups
    const resultById: Record<string, string> = {};
    const resultByPair: Record<string, string> = {};
    for (const m of matchList) {
      if (m?.id && m?.result) resultById[m.id] = m.result;
      const a = (m?.team_a?.name ?? '').toString().toLowerCase().trim();
      const b = (m?.team_b?.name ?? '').toString().toLowerCase().trim();
      if (a && b && m?.result) resultByPair[`${a}__${b}`] = m.result;
    }
    const resolveResult = (pick: any): string | null => {
      if (pick?.match_id && resultById[pick.match_id]) return resultById[pick.match_id];
      const a = (pick?.team_a ?? '').toString().toLowerCase().trim();
      const b = (pick?.team_b ?? '').toString().toLowerCase().trim();
      return resultByPair[`${a}__${b}`] ?? null;
    };

    return bets.map((bet: any) => {
      const uid   = bet?.user_id ?? bet?.id;
      // Prefer merged picks (data.bets ∪ current user's own ticket fallback)
      const picks = picksMapByUser.get(uid) ?? bet?.picks ?? [];
      // Per-pick correctness: prefer backend, fall back to client-side compute
      const annotated = picks.map((p: any) => {
        if (p?.is_correct != null) return p.is_correct;
        const r = resolveResult(p);
        return computeIsCorrect(p?.pick, r);
      });
      const correctSoFar = annotated.filter((c: any) => c === true).length;
      const wrongSoFar   = annotated.filter((c: any) => c === false).length;
      const pendingPicks = annotated.filter((c: any) => c == null).length;
      // Backend total takes priority ONLY if it's >= our computed (final source post-resolution)
      const totalCorrect = bet?.total_correct != null && Number(bet.total_correct) >= correctSoFar
        ? Number(bet.total_correct)
        : correctSoFar;
      return { ...bet, correctSoFar, wrongSoFar, pendingPicks, totalCorrect };
    });
  }, [data?.bets, matchday?.matches]);

  // Orden ALFABÉTICO por nombre. Esto es un registro de apuestas (para buscar
  // gente), no un ranking: el rendimiento se ve en la sección de "líderes" de
  // arriba y en los ✓/✗ de cada fila. topCorrect/leaders se calculan con max
  // aparte, así que NO dependen de este orden.
  const sortedBets = useMemo(() => {
    return [...betsWithStats].sort((a: any, b: any) =>
      String(a?.full_name ?? a?.username ?? '').localeCompare(
        String(b?.full_name ?? b?.username ?? ''), 'es',
      ),
    );
  }, [betsWithStats]);

  const visibleBets = useMemo(() => {
    if (!userSearch.trim()) return sortedBets;
    const q = userSearch.toLowerCase();
    return sortedBets.filter((b: any) =>
      (b?.full_name ?? '').toLowerCase().includes(q) ||
      (b?.username ?? '').toLowerCase().includes(q)
    );
  }, [sortedBets, userSearch]);

  // ── Autosize de la columna de usuario en la matriz ───────────────────────
  // Era fija (150px) -> los nombres largos se cortaban. Se ajusta al nombre más
  // largo de la lista (incluye sufijo " · TÚ"). pivotUserCell tiene 39px fijos
  // (posCircle 22 + gap 7 + paddingRight 10); el nombre es 12px Poppins SemiBold
  // ≈ 7.2px/char. Clamp 150–300px. Basado en sortedBets (lista completa) para
  // que la columna NO salte de ancho al filtrar por búsqueda.
  const userColW = useMemo(() => {
    const longest = sortedBets.reduce((m: number, b: any) => {
      const uid   = b?.user_id ?? b?.id;
      const extra = user?.id && uid === user.id ? 5 : 0; // sufijo " · TÚ"
      return Math.max(m, String(b?.full_name ?? '-').length + extra);
    }, 0);
    return Math.round(Math.min(320, Math.max(150, 51 + longest * 7.2 + 6)));
  }, [sortedBets, user?.id]);

  // Leaders = users tied for the top correct count (only meaningful if > 0).
  // Se calcula con MAX (no sortedBets[0]) porque la lista ahora está en orden
  // alfabético, no por rendimiento.
  const topCorrect = betsWithStats.reduce(
    (m: number, b: any) => Math.max(m, Number(b?.totalCorrect ?? 0)),
    0,
  );
  const leaders    = topCorrect > 0
    ? sortedBets.filter((b) => b.totalCorrect === topCorrect)
    : [];

  // Any match resolved (with a result) means we can start showing leaders
  const anyMatchResolved = useMemo(() => {
    return (matchday?.matches ?? []).some((m: any) => !!m?.result);
  }, [matchday?.matches]);

  // ── PER-MATCH BREAKDOWN ────────────────────────────────────────────────────
  // For each match, group users into: acertaron / fallaron / sin apuesta.
  // Used by the "Aciertos por Partido" section.
  const perMatchBreakdown = useMemo(() => {
    const matches: any[] = matchday?.matches ?? [];
    if (matches.length === 0) return [];

    return matches.map((match: any) => {
      const matchStartMs = match?.match_date ? new Date(match.match_date).getTime() : NaN;
      const hasStarted   = !isNaN(matchStartMs) && matchStartMs <= now;
      const hasResult    = !!match?.result;
      const matchTeamAName = (match?.team_a?.name ?? '').toString().toLowerCase().trim();
      const matchTeamBName = (match?.team_b?.name ?? '').toString().toLowerCase().trim();

      // Find each user's pick for THIS match.
      // Uses merged map (data.bets picks + current user's own ticket as fallback).
      // Tries BOTH match_id AND team-name matching, OR'd — so a mismatch on one
      // can still find the pick via the other.
      const userPicks = (data?.bets ?? []).map((bet: any) => {
        const uid = bet?.user_id ?? bet?.id;
        const userPicksList = picksMapByUser.get(uid) ?? bet?.picks ?? [];
        const myPick = userPicksList.find((p: any) => {
          // 1) Match by ID
          if (p?.match_id && match?.id && p.match_id === match.id) return true;
          // 2) Match by exact team name pair (handles strings OR { name } objects)
          const pa = (p?.team_a?.name ?? p?.team_a ?? '').toString().toLowerCase().trim();
          const pb = (p?.team_b?.name ?? p?.team_b ?? '').toString().toLowerCase().trim();
          if (pa && pb && pa === matchTeamAName && pb === matchTeamBName) return true;
          // 3) Match by reversed pair (in case orientation differs)
          if (pa && pb && pa === matchTeamBName && pb === matchTeamAName) return true;
          // 4) Match by nested match.id / match.team_a / match.team_b structure
          if (p?.match?.id && match?.id && p.match.id === match.id) return true;
          const ma = (p?.match?.team_a?.name ?? '').toString().toLowerCase().trim();
          const mb = (p?.match?.team_b?.name ?? '').toString().toLowerCase().trim();
          if (ma && mb && ma === matchTeamAName && mb === matchTeamBName) return true;
          return false;
        });
        const pickedTeam =
          PICK_LABELS_LOCAL.includes(myPick?.pick)   ? (match?.team_a?.name ?? 'Local')     :
          PICK_LABELS_VISITOR.includes(myPick?.pick) ? (match?.team_b?.name ?? 'Visitante') :
          PICK_LABELS_DRAW.includes(myPick?.pick)    ? 'Empate' : null;
        // Prefer backend's is_correct, fall back to client-side computation
        const isCorrect = myPick?.is_correct != null
          ? myPick.is_correct
          : computeIsCorrect(myPick?.pick, match?.result);
        return {
          user_id:    bet?.user_id ?? bet?.id,
          username:   bet?.username ?? '-',
          full_name:  bet?.full_name ?? '-',
          pick:       myPick?.pick,
          pickedTeam,
          isCorrect,
          hasPick:    !!myPick,
        };
      });

      const correct  = userPicks.filter((u: any) => u.isCorrect === true);
      const wrong    = userPicks.filter((u: any) => u.isCorrect === false);
      // "didn't pick this match" — user has a ticket for the jornada but no pick
      // for THIS specific match. Tagged so the UI can label them differently.
      const noPickInThisMatch = userPicks
        .filter((u: any) => !u.hasPick)
        .map((u: any) => ({ ...u, reason: 'no_match_pick' as const }));
      // Users who didn't bet at all on the jornada
      const skippedJornada = nonBettors.map((u: any) => ({
        user_id:   u.user_id,
        username:  u.username,
        full_name: u.full_name,
        reason:    'no_ticket' as const,
      }));
      // Combined "Sin apuesta" bucket for this match
      const skipped = [...noPickInThisMatch, ...skippedJornada];

      // Resolved team name (the team that won, or 'Empate')
      let resultLabel: string | null = null;
      if (hasResult) {
        if (PICK_LABELS_LOCAL.includes(match?.result))   resultLabel = match?.team_a?.name ?? 'Local';
        else if (PICK_LABELS_VISITOR.includes(match?.result)) resultLabel = match?.team_b?.name ?? 'Visitante';
        else                                              resultLabel = 'Empate';
      }

      return {
        match,
        hasStarted,
        hasResult,
        resultLabel,
        userPicks,
        correct,
        wrong,
        noPickInThisMatch,
        skipped,
      };
    });
  }, [matchday?.matches, data?.bets, nonBettors, now]);

  // Pick-code → label/color
  const pickInfo = (code: string) => {
    if (PICK_LABELS_LOCAL.includes(code))   return { label: 'Local',     color: '#3B82F6' };
    if (PICK_LABELS_DRAW.includes(code))    return { label: 'Empate',    color: '#F59E0B' };
    if (PICK_LABELS_VISITOR.includes(code)) return { label: 'Visitante', color: '#EF4444' };
    return { label: code ?? '-', color: theme.colors.textSecondary };
  };

  // Friendly team-aware pick label (e.g. "Gana Brasil")
  const pickTeamLabel = (pick: any) => {
    if (PICK_LABELS_LOCAL.includes(pick?.pick))   return pick?.team_a ?? 'Local';
    if (PICK_LABELS_VISITOR.includes(pick?.pick)) return pick?.team_b ?? 'Visitante';
    return 'Empate';
  };

  const formatTime = (dateStr: string) => {
    try {
      const d   = new Date(dateStr);
      const day = String(d.getDate()).padStart(2, '0');
      const mo  = String(d.getMonth() + 1).padStart(2, '0');
      const hh  = String(d.getHours()).padStart(2, '0');
      const mm  = String(d.getMinutes()).padStart(2, '0');
      return `${day}/${mo}  ${hh}:${mm}`;
    } catch { return '-'; }
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
              <Text style={styles.headerTitle}>Registro de Apuestas</Text>
              <View style={styles.liveRow}>
                <View style={styles.liveDot} />
                <Text style={styles.liveLabel}>EN VIVO</Text>
                <Text style={styles.headerSub} numberOfLines={1}>
                  · {data?.matchday_name ?? 'Cargando...'}
                </Text>
              </View>
            </View>
            <View style={styles.countBadge}>
              <Text style={styles.countNum}>{data?.total_bets ?? 0}</Text>
              <Text style={styles.countLabel}>apuestas</Text>
            </View>
          </View>
        </LinearGradient>
      </Animated.View>

      <ScrollView
        showsVerticalScrollIndicator={true}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primaryLight} />
        }
      >
        {/* Per-match reveal notice (no longer all-or-nothing) */}
        {(data?.total_bets ?? 0) > 0 && (
          <Animated.View
            entering={FadeInDown.duration(400)}
            style={[styles.noticeBanner, { backgroundColor: theme.colors.primaryLight + '14', borderColor: theme.colors.primaryLight + '40' }]}
          >
            <Ionicons name="eye-outline" size={16} color={theme.colors.primaryLight} />
            <Text style={[styles.noticeText, { color: theme.colors.primaryLight }]}>
              Cada pronóstico se revela cuando el partido al que corresponde comienza.
            </Text>
          </Animated.View>
        )}

        {/* ─── LEADERBOARD ────────────────────────────────────────────────────
            Real-time ranking by correct picks. Only shown once at least one
            match has resolved (otherwise everyone is tied at 0). */}
        {anyMatchResolved && leaders.length > 0 && (
          <Animated.View
            entering={FadeInDown.delay(80).duration(400)}
            style={[styles.leaderBox, {
              backgroundColor: theme.colors.surface,
              borderColor: '#FFD70055',
            }]}
          >
            <LinearGradient
              colors={['#FFD700', '#F59E0B', 'transparent']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={{ height: 2 }}
            />
            <View style={styles.leaderBody}>
              <View style={styles.leaderHeader}>
                <Ionicons name="trophy" size={18} color="#FFD700" />
                <Text style={[styles.leaderHeaderTitle, { color: theme.colors.textPrimary }]}>
                  {leaders.length === 1
                    ? 'Líder de la jornada'
                    : `Empate en primer lugar (${leaders.length})`}
                </Text>
                <View style={[styles.leaderCorrectBadge, { backgroundColor: '#10B98118', borderColor: '#10B98155' }]}>
                  <Ionicons name="checkmark-circle" size={12} color="#10B981" />
                  <Text style={[styles.leaderCorrectBadgeText, { color: '#10B981' }]}>
                    {topCorrect} acierto{topCorrect === 1 ? '' : 's'}
                  </Text>
                </View>
              </View>
              <View style={styles.leaderList}>
                {leaders.map((l: any, i: number) => (
                  <View key={l.user_id ?? i} style={styles.leaderRow}>
                    <Text style={styles.leaderMedal}>
                      {leaders.length === 1 ? '🏆' : '🥇'}
                    </Text>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.leaderName, { color: theme.colors.textPrimary }]} numberOfLines={1}>
                        {l.full_name ?? '-'}
                      </Text>
                      {/* Privacidad: solo nombre — sin @usuario */}
                    </View>
                    {l.pendingPicks > 0 && (
                      <Text style={[styles.leaderPending, { color: theme.colors.textMuted }]}>
                        +{l.pendingPicks} pendiente{l.pendingPicks === 1 ? '' : 's'}
                      </Text>
                    )}
                  </View>
                ))}
              </View>
              {sortedBets.length > leaders.length && (
                <Text style={[styles.leaderFootnote, { color: theme.colors.textMuted }]}>
                  Ranking en vivo · se actualiza al resolverse cada partido
                </Text>
              )}
            </View>
          </Animated.View>
        )}

        {/* ─── Aciertos por Partido ───────────────────────────────────────────
            Graphic breakdown per match: who got it right / wrong / didn't bet.
            Picks for unstarted matches stay hidden. */}
        {perMatchBreakdown.length > 0 && (data?.total_bets ?? 0) > 0 && (
          <Animated.View
            entering={FadeInDown.delay(120).duration(400)}
            style={styles.perMatchSection}
          >
            <View style={[styles.sectionHeaderBar, { borderLeftColor: theme.colors.primaryLight, backgroundColor: theme.colors.inputBg, borderBottomColor: theme.colors.border }]}>
              <Ionicons name="analytics-outline" size={16} color={theme.colors.primaryLight} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.sectionHeaderBarTitle, { color: theme.colors.textPrimary }]}>
                  Aciertos por Partido
                </Text>
                <Text style={[styles.sectionHeaderBarSub, { color: theme.colors.textMuted }]}>
                  Quién acertó cada partido, quién falló y quién no apostó
                </Text>
              </View>
            </View>

            {perMatchBreakdown.map((m: any, mi: number) => {
              const teamAName = m.match?.team_a?.name ?? 'Local';
              const teamBName = m.match?.team_b?.name ?? 'Visitante';
              const matchKey  = String(m.match?.id ?? mi);
              const expanded  = !!expandedMatches[matchKey];
              const scoreLabel = m.match?.score_a != null && m.match?.score_b != null
                ? `${m.match.score_a} - ${m.match.score_b}`
                : null;

              const resColor = PICK_LABELS_LOCAL.includes(m.match?.result)   ? '#3B82F6'
                            : PICK_LABELS_VISITOR.includes(m.match?.result) ? '#EF4444'
                            : PICK_LABELS_DRAW.includes(m.match?.result)    ? '#F59E0B'
                            : theme.colors.textMuted;

              return (
                <View
                  key={matchKey}
                  style={[styles.matchSlim, {
                    backgroundColor: theme.colors.surface,
                    borderColor: m.hasResult ? resColor + '50' : theme.colors.border,
                  }]}
                >
                  {/* Single-line match summary — always visible */}
                  <Pressable
                    onPress={() => m.hasResult && toggleMatch(matchKey)}
                    style={({ pressed }) => [
                      styles.matchSlimHeader,
                      pressed && m.hasResult && { opacity: 0.75 },
                    ]}
                  >
                    <View style={styles.matchSlimTitleRow}>
                      <View style={styles.matchTeamsInline}>
                        <TeamFlag team={m.match?.team_a} size={18} />
                        <Text style={[styles.matchSlimTeam, { color: theme.colors.textPrimary }]} numberOfLines={1}>
                          {teamAName}
                        </Text>
                        <Text style={[styles.matchSlimScore, { color: theme.colors.textMuted }]}>
                          {scoreLabel ?? 'vs'}
                        </Text>
                        <Text style={[styles.matchSlimTeam, { color: theme.colors.textPrimary }]} numberOfLines={1}>
                          {teamBName}
                        </Text>
                        <TeamFlag team={m.match?.team_b} size={18} />
                      </View>
                      {m.hasResult && (
                        <Ionicons
                          name={expanded ? 'chevron-up' : 'chevron-down'}
                          size={16}
                          color={theme.colors.textMuted}
                        />
                      )}
                    </View>

                    {/* Sub-row: status pill + leader chips + counts */}
                    <View style={styles.matchSlimSubRow}>
                      {m.hasResult ? (
                        <>
                          <View style={[styles.statusChip, { backgroundColor: resColor + '20', borderColor: resColor + '60' }]}>
                            <Ionicons name="trophy" size={11} color={resColor} />
                            <Text style={[styles.statusChipText, { color: resColor }]}>
                              {m.resultLabel}
                            </Text>
                          </View>
                          {/* Leaders for this match (acertaron) */}
                          {m.correct.length > 0 ? (
                            <View style={[styles.correctCountPill, { backgroundColor: '#10B98118', borderColor: '#10B98155' }]}>
                              <Ionicons name="checkmark-circle" size={11} color="#10B981" />
                              <Text style={[styles.correctCountText, { color: '#10B981' }]}>
                                {m.correct.length} acertaron
                              </Text>
                            </View>
                          ) : (
                            <View style={[styles.correctCountPill, { backgroundColor: theme.colors.inputBg, borderColor: theme.colors.border }]}>
                              <Ionicons name="time-outline" size={11} color={theme.colors.textMuted} />
                              <Text style={[styles.correctCountText, { color: theme.colors.textMuted }]}>
                                Pendiente
                              </Text>
                            </View>
                          )}
                          {/* Compact counts on the right */}
                          <View style={styles.countsRow}>
                            <Text style={[styles.countItem, { color: '#10B981' }]}>✓{m.correct.length}</Text>
                            <Text style={[styles.countItem, { color: '#EF4444' }]}>✗{m.wrong.length}</Text>
                            {m.skipped.length > 0 && (
                              <Text style={[styles.countItem, { color: theme.colors.textMuted }]}>○{m.skipped.length}</Text>
                            )}
                          </View>
                        </>
                      ) : (
                        <>
                          <View style={[styles.statusChip, {
                            backgroundColor: m.hasStarted ? '#F59E0B14' : theme.colors.inputBg,
                            borderColor: m.hasStarted ? '#F59E0B40' : theme.colors.border,
                          }]}>
                            <Ionicons
                              name={m.hasStarted ? 'play-circle' : 'time-outline'}
                              size={11}
                              color={m.hasStarted ? '#F59E0B' : theme.colors.textMuted}
                            />
                            <Text style={[styles.statusChipText, { color: m.hasStarted ? '#F59E0B' : theme.colors.textMuted }]}>
                              {m.hasStarted ? 'En curso' : 'Aún no juega'}
                            </Text>
                          </View>
                          {m.match?.match_date && (
                            <Text style={[styles.matchSlimDate, { color: theme.colors.textMuted }]}>
                              {formatTime(m.match.match_date)}
                            </Text>
                          )}
                        </>
                      )}
                    </View>
                  </Pressable>

                  {/* Expanded detail (only for resolved matches that user tapped) */}
                  {m.hasResult && expanded && (
                    <View style={styles.matchSlimDetail}>
                      {/* Acertaron */}
                      <View style={styles.detailGroup}>
                        <Text style={[styles.detailGroupTitle, { color: '#10B981' }]}>
                          ✅ Acertaron ({m.correct.length})
                        </Text>
                        {m.correct.length === 0 ? (
                          <Text style={[styles.detailEmpty, { color: theme.colors.textMuted }]}>
                            Sin aciertos en este partido
                          </Text>
                        ) : (
                          <View style={[styles.detailRowList, { borderColor: '#10B98130' }]}>
                            {m.correct.map((u: any, ui: number) => {
                              const isMe = user?.id && u.user_id === user.id;
                              return (
                                <View
                                  key={u.user_id ?? ui}
                                  style={[styles.detailRow, { borderBottomColor: theme.colors.border }, isMe && styles.detailRowMe]}
                                >
                                  <View style={[styles.detailRowAvatar, { backgroundColor: '#10B98122' }]}>
                                    <Text style={[styles.detailRowInitial, { color: '#10B981' }]}>
                                      {(u.full_name ?? '-')[0].toUpperCase()}
                                    </Text>
                                  </View>
                                  <Text style={[styles.detailRowName, { color: theme.colors.textPrimary }]} numberOfLines={1}>
                                    {u.full_name}{isMe ? ' · TÚ' : ''}
                                  </Text>
                                  <View style={[styles.detailRowBadge, { backgroundColor: '#10B98118', borderColor: '#10B98140' }]}>
                                    <Text style={[styles.detailRowBadgeText, { color: '#10B981' }]} numberOfLines={1}>
                                      {u.pickedTeam}
                                    </Text>
                                  </View>
                                </View>
                              );
                            })}
                          </View>
                        )}
                      </View>

                      {/* Fallaron */}
                      <View style={styles.detailGroup}>
                        <Text style={[styles.detailGroupTitle, { color: '#EF4444' }]}>
                          ❌ Fallaron ({m.wrong.length})
                        </Text>
                        {m.wrong.length === 0 ? (
                          <Text style={[styles.detailEmpty, { color: theme.colors.textMuted }]}>
                            Nadie falló en este partido
                          </Text>
                        ) : (
                          <View style={[styles.detailRowList, { borderColor: '#EF444430' }]}>
                            {m.wrong.map((u: any, ui: number) => {
                              const isMe = user?.id && u.user_id === user.id;
                              return (
                                <View
                                  key={u.user_id ?? ui}
                                  style={[styles.detailRow, { borderBottomColor: theme.colors.border }, isMe && styles.detailRowMe]}
                                >
                                  <View style={[styles.detailRowAvatar, { backgroundColor: '#EF444422' }]}>
                                    <Text style={[styles.detailRowInitial, { color: '#EF4444' }]}>
                                      {(u.full_name ?? '-')[0].toUpperCase()}
                                    </Text>
                                  </View>
                                  <Text style={[styles.detailRowName, { color: theme.colors.textPrimary }]} numberOfLines={1}>
                                    {u.full_name}{isMe ? ' · TÚ' : ''}
                                  </Text>
                                  <View style={[styles.detailRowBadge, { backgroundColor: '#EF444418', borderColor: '#EF444440' }]}>
                                    <Text style={[styles.detailRowBadgeText, { color: '#EF4444' }]} numberOfLines={1}>
                                      {u.pickedTeam ?? '-'}
                                    </Text>
                                  </View>
                                </View>
                              );
                            })}
                          </View>
                        )}
                      </View>

                      {/* Sin apuesta para este partido */}
                      {m.skipped.length > 0 && (
                        <View style={styles.detailGroup}>
                          <Text style={[styles.detailGroupTitle, { color: theme.colors.textMuted }]}>
                            🚫 Sin apuesta en este partido ({m.skipped.length})
                          </Text>
                          <View style={[styles.detailRowList, { borderColor: theme.colors.border }]}>
                            {m.skipped.map((u: any, ui: number) => {
                              const isMe        = user?.id && u.user_id === user.id;
                              const noTicket    = u.reason === 'no_ticket';
                              const reasonLabel = noTicket ? 'Sin boleto' : 'Sin pick';
                              return (
                                <View
                                  key={u.user_id ?? ui}
                                  style={[styles.detailRow, { borderBottomColor: theme.colors.border }, isMe && styles.detailRowMe]}
                                >
                                  <View style={[styles.detailRowAvatar, { backgroundColor: theme.colors.inputBg }]}>
                                    <Text style={[styles.detailRowInitial, { color: theme.colors.textMuted }]}>
                                      {(u.full_name ?? '-')[0].toUpperCase()}
                                    </Text>
                                  </View>
                                  <Text style={[styles.detailRowName, { color: theme.colors.textSecondary }]} numberOfLines={1}>
                                    {u.full_name}{isMe ? ' · TÚ' : ''}
                                  </Text>
                                  <View style={[styles.detailRowBadge, { backgroundColor: theme.colors.inputBg, borderColor: theme.colors.border }]}>
                                    <Text style={[styles.detailRowBadgeText, { color: theme.colors.textMuted }]}>
                                      {reasonLabel}
                                    </Text>
                                  </View>
                                </View>
                              );
                            })}
                          </View>
                        </View>
                      )}
                    </View>
                  )}
                </View>
              );
            })}
          </Animated.View>
        )}

        {isLoading ? (
          <View style={{ gap: 12 }}>
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} width="100%" height={80} style={{ borderRadius: 14 }} />
            ))}
          </View>
        ) : (data?.bets?.length ?? 0) === 0 ? (
          <EmptyState
            icon="document-text-outline"
            title="Sin apuestas aún"
            description="Cuando los participantes apuesten, aparecerán aquí"
          />
        ) : (
          <View style={styles.list}>
            {/* Search + view toggle */}
            <View style={styles.searchRow}>
              <View style={[styles.searchInputWrap, { backgroundColor: theme.colors.inputBg, borderColor: theme.colors.border }]}>
                <Ionicons name="search-outline" size={15} color={theme.colors.textMuted} />
                <TextInput
                  style={[styles.searchInput, { color: theme.colors.textPrimary }]}
                  value={userSearch}
                  onChangeText={setUserSearch}
                  placeholder="Buscar participante..."
                  placeholderTextColor={theme.colors.textMuted}
                />
                {userSearch.length > 0 && (
                  <Pressable onPress={() => setUserSearch('')} hitSlop={8}>
                    <Ionicons name="close-circle" size={15} color={theme.colors.textMuted} />
                  </Pressable>
                )}
              </View>

            </View>
            {/* Section header */}
            <View style={[styles.sectionHeaderBar, { borderLeftColor: theme.colors.primary, backgroundColor: theme.colors.inputBg, borderBottomColor: theme.colors.border }]}>
              <Ionicons name="people-outline" size={16} color={theme.colors.primary} />
              <Text style={[styles.sectionHeaderBarTitle, { color: theme.colors.textPrimary, flex: 1 }]}>
                Participantes ({visibleBets.length}{userSearch ? ` de ${sortedBets.length}` : ''})
              </Text>

            </View>
            {false && visibleBets.map((bet: any, idx: number) => {
              const isLeader  = anyMatchResolved && bet.totalCorrect === topCorrect && topCorrect > 0;
              const medal     = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : null;
              const posColor  =
                idx === 0 ? '#FFD700' :
                idx === 1 ? '#C0C0C0' :
                idx === 2 ? '#CD7F32' :
                theme.colors.primaryLight;
              return (
              <Animated.View
                key={bet?.user_id ?? idx}
                entering={FadeInDown.delay(idx * 55).duration(340).springify()}
              >
                <View style={[
                  styles.betCard,
                  { backgroundColor: theme.colors.surface, borderColor: isLeader ? '#FFD70055' : theme.colors.border },
                ]}>
                  <LinearGradient
                    colors={isLeader
                      ? ['#FFD700', '#F59E0B', 'transparent']
                      : [theme.colors.primary, theme.colors.primaryLight, 'transparent']}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                    style={{ height: 1.5 }}
                  />
                  <Pressable
                    style={styles.betCardBody}
                    onPress={() => toggleBet(bet?.user_id ?? String(idx))}
                  >
                    {/* Header */}
                    <View style={styles.betHeader}>
                      <View style={styles.betUserRow}>
                        <View style={[styles.posCircle, { backgroundColor: posColor }]}>
                          {medal && anyMatchResolved ? (
                            <Text style={styles.posMedal}>{medal}</Text>
                          ) : (
                            <Text style={styles.posText}>{idx + 1}</Text>
                          )}
                        </View>
                        <View>
                          <Text style={[styles.betUser, { color: theme.colors.textPrimary }]}>
                            {bet?.full_name ?? '-'}
                          </Text>
                          {/* Privacidad: solo nombre — sin @usuario */}
                        </View>
                      </View>
                      <View style={styles.betMeta}>
                        <Ionicons name="time-outline" size={13} color={theme.colors.textMuted} />
                        <Text style={[styles.betTime, { color: theme.colors.textMuted }]}>
                          {formatTime(bet?.bet_time)}
                        </Text>
                        <Ionicons
                          name={expandedBets[bet?.user_id ?? String(idx)] ? 'chevron-up' : 'chevron-down'}
                          size={14}
                          color={theme.colors.textMuted}
                          style={{ marginLeft: 4 }}
                        />
                      </View>
                    </View>

                    {/* Live stats row — visible whenever ANY match has resolved.
                        Replaced by the resolved-block below when matchday is final. */}
                    {anyMatchResolved && data?.status !== 'resolved' && (
                      <View style={styles.liveStatsRow}>
                        <View style={[styles.liveStat, { backgroundColor: '#10B98114', borderColor: '#10B98140' }]}>
                          <Ionicons name="checkmark-circle" size={12} color="#10B981" />
                          <Text style={[styles.liveStatText, { color: '#10B981' }]}>
                            {bet.correctSoFar} aciertos
                          </Text>
                        </View>
                        {bet.wrongSoFar > 0 && (
                          <View style={[styles.liveStat, { backgroundColor: '#EF444414', borderColor: '#EF444440' }]}>
                            <Ionicons name="close-circle" size={12} color="#EF4444" />
                            <Text style={[styles.liveStatText, { color: '#EF4444' }]}>
                              {bet.wrongSoFar} fallos
                            </Text>
                          </View>
                        )}
                        {bet.pendingPicks > 0 && (
                          <View style={[styles.liveStat, { backgroundColor: '#F59E0B14', borderColor: '#F59E0B40' }]}>
                            <Ionicons name="time-outline" size={12} color="#F59E0B" />
                            <Text style={[styles.liveStatText, { color: '#F59E0B' }]}>
                              {bet.pendingPicks} pendiente{bet.pendingPicks === 1 ? '' : 's'}
                            </Text>
                          </View>
                        )}
                        {isLeader && (
                          <View style={[styles.liveStat, { backgroundColor: '#FFD70022', borderColor: '#FFD70055' }]}>
                            <Ionicons name="trophy" size={12} color="#F59E0B" />
                            <Text style={[styles.liveStatText, { color: '#F59E0B', fontFamily: 'Poppins_700Bold' }]}>
                              {leaders.length === 1 ? 'Líder' : 'Empate 1°'}
                            </Text>
                          </View>
                        )}
                      </View>
                    )}

                    {/* Results (resolved) */}
                    {data?.status === 'resolved' && bet?.total_correct != null && (
                      <View style={styles.resultRow}>
                        <View style={styles.resultBadge}>
                          <Text style={styles.resultLabel}>Aciertos</Text>
                          <Text style={styles.resultValue}>{bet.total_correct}</Text>
                        </View>
                        {bet.prize_won > 0 && (
                          <View style={[styles.resultBadge, { backgroundColor: 'rgba(212,160,23,0.12)' }]}>
                            <Text style={[styles.resultLabel, { color: '#F59E0B' }]}>Premio</Text>
                            <Text style={[styles.resultValue, { color: '#F59E0B' }]}>
                              {data?.currency ?? 'Bs'} {bet.prize_won?.toFixed?.(2) ?? '0'}
                            </Text>
                          </View>
                        )}
                      </View>
                    )}

                    {/* Picks — revealed per match (each one when its match starts) */}
                    {expandedBets[bet?.user_id ?? String(idx)] && bet?.picks && bet.picks.length > 0 && (
                      <View style={[styles.picksWrap, { borderTopColor: theme.colors.border }]}>
                        {bet.picks.map((pick: any, pi: number) => {
                          const revealed = isPickRevealed(pick);
                          const info     = pickInfo(pick?.pick);
                          return (
                            <View key={pi} style={styles.pickRow}>
                              <Text style={[styles.pickMatch, { color: theme.colors.textSecondary }]} numberOfLines={1}>
                                {pick?.team_a ?? '-'} vs {pick?.team_b ?? '-'}
                              </Text>
                              {revealed ? (
                                <View style={[
                                  styles.pickBadge,
                                  { backgroundColor: info.color + '20', borderColor: info.color + '50', borderWidth: 1 },
                                  pick?.is_correct === true  && { backgroundColor: 'rgba(16,185,129,0.18)', borderColor: 'rgba(16,185,129,0.5)' },
                                  pick?.is_correct === false && { backgroundColor: 'rgba(239,68,68,0.18)', borderColor: 'rgba(239,68,68,0.5)' },
                                ]}>
                                  <Text style={[
                                    styles.pickText,
                                    { color: info.color },
                                    pick?.is_correct === true  && { color: '#10B981' },
                                    pick?.is_correct === false && { color: '#EF4444' },
                                  ]} numberOfLines={1}>
                                    {pickTeamLabel(pick)}
                                  </Text>
                                </View>
                              ) : (
                                <View style={[styles.pickBadge, { backgroundColor: theme.colors.inputBg, borderColor: theme.colors.border, borderWidth: 1 }]}>
                                  <Ionicons name="lock-closed" size={11} color={theme.colors.textMuted} />
                                  <Text style={[styles.pickText, { color: theme.colors.textMuted, marginLeft: 4 }]}>
                                    Oculto
                                  </Text>
                                </View>
                              )}
                            </View>
                          );
                        })}
                      </View>
                    )}
                  </Pressable>
                </View>
              </Animated.View>
              );
            })}

            {(
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={true}
                nestedScrollEnabled
                bounces={false}
                style={{ marginHorizontal: -20 }}
                contentContainerStyle={{ paddingHorizontal: 20 }}
              >
                <View>
                  {/* Column headers: one cell per match */}
                  <View style={styles.pivotHeaderRow}>
                    <View style={[styles.pivotUserCell, { width: userColW }]} />
                    {(matchday?.matches ?? []).map((match: any, mi: number) => {
                      const scoreStr = match?.score_a != null ? `${match.score_a}-${match.score_b}` : null;
                      const resColor = PICK_LABELS_LOCAL.includes(match?.result)   ? '#3B82F6'
                        : PICK_LABELS_VISITOR.includes(match?.result) ? '#EF4444'
                        : PICK_LABELS_DRAW.includes(match?.result)    ? '#F59E0B'
                        : theme.colors.textMuted;
                      return (
                        <View key={match?.id ?? mi} style={[styles.pivotMatchCell, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
                          <TeamFlag team={match?.team_a} size={22} />
                          <Text style={[styles.pivotMatchScore, { color: scoreStr ? resColor : theme.colors.textMuted }]}>
                            {scoreStr ?? 'vs'}
                          </Text>
                          <TeamFlag team={match?.team_b} size={22} />
                        </View>
                      );
                    })}
                  </View>

                  {/* Data rows — one per user */}
                  {visibleBets.map((bet: any, idx: number) => {
                    const uid = bet?.user_id ?? bet?.id;
                    const userPicksList = picksMapByUser.get(uid) ?? bet?.picks ?? [];
                    const isMe     = user?.id && uid === user.id;
                    const posColor = idx === 0 ? '#FFD700' : idx === 1 ? '#C0C0C0' : idx === 2 ? '#CD7F32' : theme.colors.primaryLight;
                    return (
                      <View
                        key={uid ?? idx}
                        style={[styles.pivotRow, {
                          backgroundColor: isMe ? theme.colors.primaryLight + '10' : idx % 2 === 0 ? theme.colors.surface : theme.colors.inputBg,
                          borderBottomColor: theme.colors.border,
                        }]}
                      >
                        {/* User info cell */}
                        <View style={[styles.pivotUserCell, { width: userColW, borderRightColor: theme.colors.border }]}>
                          <View style={[styles.pivotPosCircle, { backgroundColor: posColor }]}>
                            <Text style={[styles.pivotPosText, { color: '#fff' }]}>{idx + 1}</Text>
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.pivotUserName, { color: theme.colors.textPrimary }]} numberOfLines={1}>
                              {bet?.full_name ?? '-'}{isMe ? ' · TÚ' : ''}
                            </Text>
                            <Text style={[styles.pivotStats, { color: theme.colors.textMuted }]}>
                              ✓{bet.correctSoFar}{bet.wrongSoFar > 0 ? `  ✗${bet.wrongSoFar}` : ''}
                            </Text>
                          </View>
                        </View>

                        {/* Pick cells — one per match */}
                        {(matchday?.matches ?? []).map((match: any, mi: number) => {
                          const matchStarted = match?.match_date ? new Date(match.match_date).getTime() <= now : false;
                          const pick = userPicksList.find((p: any) => {
                            if (p?.match_id && match?.id && p.match_id === match.id) return true;
                            const pa = (p?.team_a?.name ?? p?.team_a ?? '').toString().toLowerCase().trim();
                            const pb = (p?.team_b?.name ?? p?.team_b ?? '').toString().toLowerCase().trim();
                            const ma = (match?.team_a?.name ?? '').toString().toLowerCase().trim();
                            const mb = (match?.team_b?.name ?? '').toString().toLowerCase().trim();
                            return pa && pb && pa === ma && pb === mb;
                          });
                          const revealed = pick ? isPickRevealed(pick) : false;
                          if (!matchStarted) {
                            return (
                              <View key={mi} style={[styles.pivotCell, { borderRightColor: theme.colors.border }]}>
                                <Ionicons name="time-outline" size={13} color={theme.colors.textMuted} />
                              </View>
                            );
                          }
                          if (!pick || !revealed) {
                            return <View key={mi} style={[styles.pivotCell, { borderRightColor: theme.colors.border }]} />;
                          }
                          // Partido iniciado + pick revelado: mostramos POR QUIÉN apostó
                          // (bandera del equipo elegido, o "E" de empate) y, si ya hay
                          // resultado, el ✓/✗ al lado. Antes solo salía ✓/✗ → en un partido
                          // en curso (sin resultado todavía) la celda quedaba vacía.
                          const code = pick?.pick;
                          const pickedLocal   = PICK_LABELS_LOCAL.includes(code);
                          const pickedVisitor = PICK_LABELS_VISITOR.includes(code);
                          const pickedDraw    = PICK_LABELS_DRAW.includes(code);
                          const isCorrect = pick?.is_correct ?? computeIsCorrect(code, match?.result);
                          return (
                            <View key={mi} style={[styles.pivotCell, { borderRightColor: theme.colors.border }]}>
                              <View style={styles.pivotPickWrap}>
                                {pickedLocal   && <TeamFlag team={match?.team_a} size={20} />}
                                {pickedVisitor && <TeamFlag team={match?.team_b} size={20} />}
                                {pickedDraw    && (
                                  <View style={styles.pivotDrawBadge}>
                                    <Text style={styles.pivotDrawText}>E</Text>
                                  </View>
                                )}
                                {isCorrect === true  && <Ionicons name="checkmark-circle" size={14} color="#10B981" />}
                                {isCorrect === false && <Ionicons name="close-circle"     size={14} color="#EF4444" />}
                              </View>
                            </View>
                          );
                        })}
                      </View>
                    );
                  })}
                </View>
              </ScrollView>
            )}
          </View>
        )}

        {/* ── Sin apuesta — usuarios inscritos en el torneo que no apostaron ── */}
        {nonBettors.length > 0 && (
          <Animated.View
            entering={FadeInDown.delay(200).duration(360)}
            style={styles.noBetSection}
          >
            <Pressable
              onPress={() => setShowNoBetUsers((v) => !v)}
              style={styles.noBetHeader}
            >
              <View style={[styles.noBetHeaderIcon, { backgroundColor: '#EF444418', borderColor: '#EF444440' }]}>
                <Ionicons name="alert-circle" size={15} color="#EF4444" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.noBetHeaderTitle, { color: theme.colors.textPrimary }]}>
                  Sin apuesta
                </Text>
                <Text style={[styles.noBetHeaderSub, { color: theme.colors.textMuted }]}>
                  {nonBettors.length} {nonBettors.length === 1 ? 'usuario inscrito no apostó' : 'usuarios inscritos no apostaron'}
                </Text>
              </View>
              <Ionicons
                name={showNoBetUsers ? 'chevron-up' : 'chevron-down'}
                size={18}
                color={theme.colors.textMuted}
              />
            </Pressable>

            {showNoBetUsers && (
              <View style={styles.noBetList}>
                {nonBettors.map((u: any, i: number) => (
                  <View
                    key={u.user_id ?? i}
                    style={[styles.noBetRow, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
                  >
                    <View style={[styles.noBetAvatar, { backgroundColor: theme.colors.inputBg, borderColor: theme.colors.border }]}>
                      <Ionicons name="person" size={14} color={theme.colors.textMuted} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.noBetName, { color: theme.colors.textPrimary }]}>
                        {u.full_name}
                      </Text>
                      {/* Privacidad: solo nombre — sin @usuario */}
                    </View>
                    <View style={[styles.noBetTag, { backgroundColor: '#EF444415', borderColor: '#EF444440' }]}>
                      <Text style={[styles.noBetTagText, { color: '#EF4444' }]}>
                        No apostó
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </Animated.View>
        )}
      </ScrollView>
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
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 22, fontFamily: 'Poppins_800ExtraBold', color: '#fff', letterSpacing: -0.4 },
  headerSub:   { fontSize: 12, fontFamily: 'Poppins_400Regular', color: 'rgba(255,255,255,0.6)', marginTop: 1 },
  countBadge: {
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6,
    alignItems: 'center',
  },
  countNum:   { fontSize: 16, fontFamily: 'Poppins_700Bold', color: '#fff' },
  countLabel: { fontSize: 10, fontFamily: 'Poppins_400Regular', color: 'rgba(255,255,255,0.7)' },

  scrollContent: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 100 },

  noticeBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: 12, borderWidth: 1,
    paddingHorizontal: 12, paddingVertical: 10,
    marginBottom: 14,
  },
  noticeText: { flex: 1, fontSize: 12, fontFamily: 'Poppins_400Regular', lineHeight: 18 },

  list: { gap: 12 },

  betCard: {
    borderRadius: 14, borderWidth: 1, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.14, shadowRadius: 8, elevation: 4,
  },
  betCardBody: { padding: 14 },
  betHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  betUserRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  posCircle: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  posText:   { fontSize: 12, fontFamily: 'Poppins_700Bold', color: '#fff' },
  posMedal:  { fontSize: 16, lineHeight: 20 },

  // Leaderboard banner
  leaderBox: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 14,
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 4,
  },
  leaderBody: { padding: 12 },
  leaderHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  leaderHeaderTitle: {
    flex: 1,
    fontSize: 13,
    fontFamily: 'Poppins_700Bold',
    letterSpacing: -0.2,
  },
  leaderCorrectBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
  },
  leaderCorrectBadgeText: {
    fontSize: 11,
    fontFamily: 'Poppins_700Bold',
  },
  leaderList: { marginTop: 8, gap: 6 },
  leaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 4,
  },
  leaderMedal: { fontSize: 22, lineHeight: 26 },
  leaderName: { fontSize: 13, fontFamily: 'Poppins_700Bold' },
  leaderHandle: { fontSize: 11, fontFamily: 'Poppins_400Regular', marginTop: 1 },
  leaderPending: {
    fontSize: 10,
    fontFamily: 'Poppins_500Medium',
  },
  leaderFootnote: {
    fontSize: 10,
    fontFamily: 'Poppins_400Regular',
    marginTop: 8,
    textAlign: 'center' as const,
    fontStyle: 'italic' as const,
  },

  // Live per-bet stats row (correct / wrong / pending pills)
  liveStatsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
  },
  liveStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
  },
  liveStatText: {
    fontSize: 10,
    fontFamily: 'Poppins_600SemiBold',
  },
  betUser:   { fontSize: 14, fontFamily: 'Poppins_600SemiBold' },
  betHandle: { fontSize: 11, fontFamily: 'Poppins_400Regular', marginTop: 1 },
  betMeta:   { flexDirection: 'row', alignItems: 'center', gap: 4 },
  betTime:   { fontSize: 11, fontFamily: 'Poppins_400Regular' },

  resultRow:   { flexDirection: 'row', gap: 8, marginTop: 10 },
  resultBadge: {
    backgroundColor: 'rgba(16,185,129,0.10)',
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, alignItems: 'center',
  },
  resultLabel: { fontSize: 10, fontFamily: 'Poppins_400Regular', color: '#10B981' },
  resultValue: { fontSize: 14, fontFamily: 'Poppins_700Bold', color: '#10B981' },

  picksWrap: { marginTop: 10, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10 },
  pickRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 5, gap: 8 },
  pickMatch: { flex: 1, fontSize: 12, fontFamily: 'Poppins_400Regular' },
  pickBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    minWidth: 88,
  },
  pickText:  { fontSize: 11, fontFamily: 'Poppins_600SemiBold' },

  // ── Sin apuesta section ────────────────────────────────────────────────────
  noBetSection: {
    marginTop: 24,
  },
  noBetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
    marginBottom: 8,
  },
  noBetHeaderIcon: {
    width: 30, height: 30, borderRadius: 9,
    borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  noBetHeaderTitle: {
    fontSize: 14,
    fontFamily: 'Poppins_700Bold',
    letterSpacing: -0.2,
  },
  noBetHeaderSub: {
    fontSize: 11,
    fontFamily: 'Poppins_400Regular',
    marginTop: 1,
  },
  noBetList: { gap: 8 },
  noBetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  noBetAvatar: {
    width: 30, height: 30, borderRadius: 15,
    borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  noBetName: { fontSize: 13, fontFamily: 'Poppins_600SemiBold' },
  noBetHandle: { fontSize: 11, fontFamily: 'Poppins_400Regular', marginTop: 1 },
  noBetTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
  },
  noBetTagText: {
    fontSize: 10,
    fontFamily: 'Poppins_700Bold',
    textTransform: 'uppercase' as const,
    letterSpacing: 0.4,
  },

  // ── Per-match breakdown section ────────────────────────────────────────────
  perMatchSection: {
    marginTop: 8,
    marginBottom: 16,
  },
  perMatchHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  perMatchTitle: {
    fontSize: 16,
    fontFamily: 'Poppins_700Bold',
    letterSpacing: -0.2,
  },
  perMatchSubtitle: {
    fontSize: 11,
    fontFamily: 'Poppins_400Regular',
    marginBottom: 12,
  },

  // ── Slim match card (per-match breakdown) ─────────────────────────────────
  matchSlim: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 8,
  },
  matchSlimHeader: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 6,
  },
  matchSlimTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  matchSlimTitle: {
    flex: 1,
    fontSize: 13,
    fontFamily: 'Poppins_700Bold',
    letterSpacing: -0.2,
  },
  matchSlimSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  matchSlimDate: {
    fontSize: 11,
    fontFamily: 'Poppins_500Medium',
  },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
  },
  statusChipText: {
    fontSize: 10,
    fontFamily: 'Poppins_700Bold',
  },
  leaderChipsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 1,
    flexWrap: 'wrap',
  },
  crownEmoji: {
    fontSize: 13,
  },
  leaderChip: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
    borderWidth: 1,
    maxWidth: 140,
  },
  leaderChipText: {
    fontSize: 10,
    fontFamily: 'Poppins_700Bold',
  },
  leaderChipMore: {
    fontSize: 10,
    fontFamily: 'Poppins_600SemiBold',
  },
  noLeaderText: {
    fontSize: 10,
    fontFamily: 'Poppins_500Medium',
    fontStyle: 'italic' as const,
  },
  countsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginLeft: 'auto' as any,
  },
  countItem: {
    fontSize: 11,
    fontFamily: 'Poppins_700Bold',
  },

  // Expanded detail (collapsed by default)
  matchSlimDetail: {
    paddingHorizontal: 12,
    paddingBottom: 12,
    gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(0,0,0,0.06)',
    paddingTop: 10,
  },
  detailGroup: {
    gap: 4,
  },
  detailGroupTitle: {
    fontSize: 10,
    fontFamily: 'Poppins_700Bold',
    textTransform: 'uppercase' as const,
    letterSpacing: 0.4,
  },
  detailEmpty: {
    fontSize: 11,
    fontFamily: 'Poppins_400Regular',
    fontStyle: 'italic' as const,
  },
  detailChipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
    marginTop: 2,
  },
  detailChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  detailChipText: {
    fontSize: 11,
    fontFamily: 'Poppins_500Medium',
  },
  detailChipPick: {
    fontSize: 10,
    fontFamily: 'Poppins_700Bold',
  },

  // ── Per-user list header ──────────────────────────────────────────────────
  listHeaderRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    marginBottom: 10,
  },
  listHeaderTitle: {
    fontSize: 14,
    fontFamily: 'Poppins_700Bold',
    letterSpacing: -0.2,
  },
  toggleAllBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
  },
  toggleAllText: {
    fontSize: 11,
    fontFamily: 'Poppins_600SemiBold',
  },

  // ── EN VIVO header indicator ───────────────────────────────────────────────
  liveRow: {
    flexDirection: 'row' as const,
    alignItems: 'center',
    gap: 5,
    marginTop: 3,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#FF3B30',
  },
  liveLabel: {
    fontSize: 10,
    fontFamily: 'Poppins_800ExtraBold',
    color: '#FF3B30',
    letterSpacing: 1.2,
  },

  // ── Correct count pill (replaces leader chips in sub-row) ──────────────────
  correctCountPill: {
    flexDirection: 'row' as const,
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
  },
  correctCountText: {
    fontSize: 10,
    fontFamily: 'Poppins_700Bold',
  },

  // ── Section header bar ─────────────────────────────────────────────────────
  sectionHeaderBar: {
    flexDirection: 'row' as const,
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderLeftWidth: 3,
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginBottom: 12,
  },
  sectionHeaderBarTitle: {
    fontSize: 14,
    fontFamily: 'Poppins_700Bold',
    letterSpacing: -0.2,
  },
  sectionHeaderBarSub: {
    fontSize: 11,
    fontFamily: 'Poppins_400Regular',
    marginTop: 1,
  },

  // ── Flat list rows in expanded per-match detail ────────────────────────────
  detailRowList: {
    borderRadius: 8,
    overflow: 'hidden' as const,
    borderWidth: 1,
    marginTop: 4,
  },
  detailRow: {
    flexDirection: 'row' as const,
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  detailRowMe: {
    backgroundColor: 'rgba(0,82,204,0.05)',
  },
  detailRowAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  detailRowInitial: {
    fontSize: 11,
    fontFamily: 'Poppins_700Bold',
  },
  detailRowName: {
    flex: 1,
    fontSize: 12,
    fontFamily: 'Poppins_500Medium',
  },
  detailRowBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  detailRowBadgeText: {
    fontSize: 10,
    fontFamily: 'Poppins_600SemiBold',
  },

  // ── Search + view toggle ──────────────────────────────────────────────────
  searchRow: {
    flexDirection: 'row' as const,
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  searchInputWrap: {
    flex: 1,
    flexDirection: 'row' as const,
    alignItems: 'center',
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  searchInput: {
    flex: 1,
    // 16px evita el zoom automático de iOS Safari al enfocar (zoom si <16px)
    fontSize: 16,
    fontFamily: 'Poppins_400Regular',
    padding: 0,
  },
  viewToggleGroup: {
    flexDirection: 'row' as const,
    gap: 4,
  },
  viewToggleBtn: {
    padding: 9,
    borderRadius: 10,
    borderWidth: 1,
  },

  // ── Match teams inline (flags + score) ────────────────────────────────────
  matchTeamsInline: {
    flex: 1,
    flexDirection: 'row' as const,
    alignItems: 'center',
    gap: 5,
  },
  matchSlimTeam: {
    fontSize: 12,
    fontFamily: 'Poppins_600SemiBold',
    flexShrink: 1,
  },
  matchSlimScore: {
    fontSize: 12,
    fontFamily: 'Poppins_700Bold',
    paddingHorizontal: 2,
  },

  // ── Pivot / matrix view ──────────────────────────────────────────────────
  pivotHeaderRow: {
    flexDirection: 'row' as const,
    alignItems: 'flex-end',
    marginBottom: 4,
  },
  pivotUserCell: {
    width: 150,
    flexDirection: 'row' as const,
    alignItems: 'center',
    gap: 7,
    paddingVertical: 8,
    paddingRight: 22,
    borderRightWidth: StyleSheet.hairlineWidth,
  },
  pivotMatchCell: {
    width: 70,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 8,
    borderWidth: 1,
    marginLeft: 4,
    gap: 4,
  },
  pivotMatchScore: {
    fontSize: 10,
    fontFamily: 'Poppins_700Bold',
  },
  pivotRow: {
    flexDirection: 'row' as const,
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    minHeight: 48,
  },
  pivotPosCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    flexShrink: 0,
  },
  pivotPosText: {
    fontSize: 10,
    fontFamily: 'Poppins_700Bold',
  },
  pivotUserName: {
    fontSize: 12,
    fontFamily: 'Poppins_600SemiBold',
  },
  pivotStats: {
    fontSize: 10,
    fontFamily: 'Poppins_500Medium',
    marginTop: 1,
  },
  pivotCell: {
    width: 70,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    height: 48,
    borderRightWidth: StyleSheet.hairlineWidth,
    marginLeft: 4,
  },
  pivotPickWrap: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 3,
  },
  pivotDrawBadge: {
    width: 22,
    height: 22,
    borderRadius: 6,
    backgroundColor: '#F59E0B22',
    borderWidth: 1,
    borderColor: '#F59E0B66',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  pivotDrawText: {
    fontSize: 11,
    fontFamily: 'Poppins_800ExtraBold',
    color: '#F59E0B',
  },
  pivotCellDash: {
    fontSize: 16,
    fontFamily: 'Poppins_400Regular',
  },
  pivotPickBadge: {
    borderRadius: 6,
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 3,
    flexDirection: 'row' as const,
    alignItems: 'center',
    gap: 2,
  },
  pivotPickText: {
    fontSize: 11,
    fontFamily: 'Poppins_700Bold',
  },
});
