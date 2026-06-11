/**
 * Ticket Detail — Premium bet ticket screen
 * Gradient header · stats card · color-coded pick rows with team names · Poppins
 */
import React, { useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  Pressable, RefreshControl,
} from 'react-native';
import { SafeAreaView }   from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons }       from '@expo/vector-icons';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { useLocalSearchParams, router } from 'expo-router';
import { safeGoBack }     from '../../../utils/navigation';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { Badge }    from '../../../components/ui/Badge';
import { Button }   from '../../../components/ui/Button';
import { Skeleton } from '../../../components/ui/Skeleton';
import { TeamFlag } from '../../../components/ui/TeamFlag';
import { useTheme } from '../../../contexts/ThemeContext';
import api from '../../../services/api';

// Format a match_date as "dd/MM HH:mm"
function formatMatchTime(dateStr?: string | null): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  const day = String(d.getDate()).padStart(2, '0');
  const mo  = String(d.getMonth() + 1).padStart(2, '0');
  const hh  = String(d.getHours()).padStart(2, '0');
  const mm  = String(d.getMinutes()).padStart(2, '0');
  return `${day}/${mo}  ${hh}:${mm}`;
}

export default function TicketDetailScreen() {
  const { id = '' }           = useLocalSearchParams<{ id: string }>();
  const { theme }             = useTheme();
  const [refreshing, setRefreshing] = React.useState(false);

  const { data: ticket, isLoading, error, refetch } = useQuery({
    queryKey: ['ticket-detail', id],
    queryFn: async () => {
      if (!id) return null;
      const res = await api.get(`/api/tickets/${id}`);
      return res?.data ?? null;
    },
    enabled: !!id,
    refetchInterval: 30000,
    // Al volver atrás conservamos el último boleto cargado mientras refetchea
    // (evita el parpadeo de "No se pudo cargar" cuando el cache está caliente).
    placeholderData: keepPreviousData,
    // No reintentar un 404 real (boleto inexistente), pero SÍ reintentar fallas
    // transitorias (red/429/503). Antes cualquier error mostraba "Boleto no encontrado".
    retry: (count, err: any) => err?.response?.status !== 404 && count < 4,
    retryDelay: (count) => Math.min(800 * 2 ** count, 5000),
  });

  // Auto-recuperación al volver atrás: si la carga falla por algo transitorio
  // (no un 404 real) — típico cuando la app refetchea todo de golpe al re-enfocar,
  // o el service worker devuelve un 503 momentáneo — reintentamos SOLOS un par de
  // veces mostrando el skeleton, y recién ahí mostramos el cartel de error.
  const [softRetries, setSoftRetries] = React.useState(0);
  React.useEffect(() => { setSoftRetries(0); }, [id]);
  const errStatus = (error as any)?.response?.status;
  const isSelfHealing = !!error && errStatus !== 404 && !ticket && softRetries < 2;
  React.useEffect(() => {
    if (!isSelfHealing) return;
    const t = setTimeout(() => {
      setSoftRetries((n) => n + 1);
      refetch();
    }, 1000 + softRetries * 1500);
    return () => clearTimeout(t);
  }, [isSelfHealing, softRetries, refetch]);

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const picks      = ticket?.ticket_picks ?? [];
  const matchday   = ticket?.matchday;
  const tournament = matchday?.tournament;
  const cur        = tournament?.currency ?? 'Bs';
  const isResolved = ticket?.status === 'resolved' || ticket?.status === 'won' || ticket?.status === 'lost';

  const correctCount   = picks.filter((p: any) => p?.is_correct === true)?.length  ?? 0;
  const incorrectCount = picks.filter((p: any) => p?.is_correct === false)?.length ?? 0;
  const pendingCount   = picks.filter((p: any) => p?.is_correct == null)?.length   ?? 0;

  // Can the user still edit picks?
  // Strategy: be PERMISSIVE — block only when explicitly closed or all matches started.
  // The bet screen itself enforces per-match lock again, so this just gates the CTA.
  const now = Date.now();
  const someMatchNotStarted = picks.length === 0 || picks.some((p: any) => {
    const dateStr = p?.match?.match_date ?? p?.match_date;
    const t = dateStr ? new Date(dateStr).getTime() : NaN;
    // No date info → assume not started yet (be optimistic; bet screen will re-verify)
    return isNaN(t) || t > now;
  });
  const matchdayClosed = matchday?.status === 'resolved'
                      || matchday?.status === 'finished'
                      || matchday?.status === 'closed';
  const canEditBet = !matchdayClosed && someMatchNotStarted && !isResolved;
  const goEditBet  = () => matchday?.id && router.push(`/quiniela/${matchday.id}` as any);

  // ─── Loading (incluye auto-reintento silencioso al volver atrás) ────────────
  if (isLoading || isSelfHealing) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.bg }]} edges={['top']}>
        <LinearGradient
          colors={[theme.colors.primary, theme.colors.primaryLight]}
          start={{ x: 0, y: 0 }} end={{ x: 0.7, y: 1 }}
          style={[styles.headerGrad, { paddingBottom: 20 }]}
        >
          <View style={styles.headerRow}>
            <Pressable onPress={() => safeGoBack('/user')} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={20} color="rgba(255,255,255,0.85)" />
            </Pressable>
          </View>
        </LinearGradient>
        <View style={{ padding: 20, gap: 12 }}>
          <Skeleton width="80%" height={28} />
          <Skeleton width="60%" height={18} />
          {[1, 2, 3].map((i) => <Skeleton key={i} width="100%" height={56} style={{ borderRadius: 14 }} />)}
        </View>
      </SafeAreaView>
    );
  }

  if (!ticket) {
    // Distinguir 404 real (boleto borrado) de una falla transitoria (red/429).
    // Antes CUALQUIER error mostraba "Boleto no encontrado" — típico al volver
    // atrás justo después de apostar, cuando la app refetchea todo y una request
    // puede fallar. Ahora ofrecemos Reintentar / Volver (no es callejón sin salida).
    const isNotFound = (error as any)?.response?.status === 404;
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.bg }]} edges={['top']}>
        <LinearGradient
          colors={[theme.colors.primary, theme.colors.primaryLight]}
          start={{ x: 0, y: 0 }} end={{ x: 0.7, y: 1 }}
          style={[styles.headerGrad, { paddingBottom: 20 }]}
        >
          <View style={styles.headerRow}>
            <Pressable onPress={() => safeGoBack('/user')} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={20} color="rgba(255,255,255,0.85)" />
            </Pressable>
            <Text style={styles.headerTitle}>{isNotFound ? 'Boleto no encontrado' : 'No se pudo cargar'}</Text>
          </View>
        </LinearGradient>

        <View style={styles.notFoundBody}>
          <Ionicons
            name={isNotFound ? 'receipt-outline' : 'cloud-offline-outline'}
            size={52}
            color={theme.colors.textMuted}
          />
          <Text style={[styles.notFoundText, { color: theme.colors.textSecondary }]}>
            {isNotFound
              ? 'No encontramos este boleto. Puede que haya sido eliminado.'
              : 'No pudimos cargar tu boleto. Revisá tu conexión e intentá de nuevo.'}
          </Text>
          <View style={styles.notFoundActions}>
            {!isNotFound && (
              <Pressable
                onPress={() => refetch()}
                style={[styles.notFoundBtn, { backgroundColor: theme.colors.primary }]}
              >
                <Ionicons name="refresh" size={16} color="#fff" />
                <Text style={styles.notFoundBtnText}>Reintentar</Text>
              </Pressable>
            )}
            <Pressable
              onPress={() => safeGoBack('/user')}
              style={[styles.notFoundBtn, { backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border }]}
            >
              <Ionicons name="arrow-back" size={16} color={theme.colors.textPrimary} />
              <Text style={[styles.notFoundBtnText, { color: theme.colors.textPrimary }]}>Volver</Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // ─── Main view ─────────────────────────────────────────────────────────────
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
              <Text style={styles.headerTitle} numberOfLines={1}>{matchday?.name ?? 'Boleto'}</Text>
              <Text style={styles.headerSub} numberOfLines={1}>{tournament?.name ?? ''}</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              {canEditBet && (
                <Pressable onPress={goEditBet} style={styles.headerActionBtn}>
                  <Ionicons name="create-outline" size={20} color="rgba(255,255,255,0.9)" />
                </Pressable>
              )}
              <Badge status={ticket?.status as any ?? 'active'} />
            </View>
          </View>
        </LinearGradient>
      </Animated.View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primaryLight} />
        }
      >
        {/* Stats card */}
        <Animated.View entering={FadeInDown.delay(80).duration(380)}>
          <View style={[styles.statsCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
            <LinearGradient
              colors={[theme.colors.primary, theme.colors.primaryLight, 'transparent']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={{ height: 1.5 }}
            />
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={[styles.statNum, { color: theme.colors.textPrimary }]}>
                  {cur} {Number(ticket?.amount_bet ?? 0).toFixed(2)}
                </Text>
                <Text style={[styles.statLabel, { color: theme.colors.textMuted }]}>Apostado</Text>
              </View>
              <View style={[styles.statDiv, { backgroundColor: theme.colors.border }]} />
              <View style={styles.statItem}>
                <Text style={[
                  styles.statNum,
                  { color: (ticket?.prize_won ?? 0) > 0 ? '#10B981' : theme.colors.textPrimary },
                ]}>
                  {cur} {Number(ticket?.prize_won ?? 0).toFixed(2)}
                </Text>
                <Text style={[styles.statLabel, { color: theme.colors.textMuted }]}>Ganado</Text>
              </View>
              <View style={[styles.statDiv, { backgroundColor: theme.colors.border }]} />
              <View style={styles.statItem}>
                <Text style={[styles.statNum, { color: theme.colors.textPrimary }]}>
                  {ticket?.total_correct ?? '-'}
                </Text>
                <Text style={[styles.statLabel, { color: theme.colors.textMuted }]}>Aciertos</Text>
              </View>
            </View>
          </View>
        </Animated.View>

        {/* Score summary */}
        {isResolved && (
          <Animated.View entering={FadeInDown.delay(160).duration(380)} style={styles.scoreBar}>
            <View style={styles.scoreItem}>
              <Ionicons name="checkmark-circle" size={17} color="#10B981" />
              <Text style={[styles.scoreText, { color: '#10B981' }]}>{correctCount} Correctos</Text>
            </View>
            <View style={styles.scoreItem}>
              <Ionicons name="close-circle" size={17} color="#EF4444" />
              <Text style={[styles.scoreText, { color: '#EF4444' }]}>{incorrectCount} Incorrectos</Text>
            </View>
          </Animated.View>
        )}

        {!isResolved && pendingCount > 0 && (
          <Animated.View
            entering={FadeInDown.delay(160).duration(380)}
            style={[styles.pendingBar, { backgroundColor: '#F59E0B10', borderColor: '#F59E0B30' }]}
          >
            <Ionicons name="time-outline" size={15} color="#F59E0B" />
            <Text style={[styles.pendingText, { color: '#F59E0B' }]}>
              {pendingCount} resultado{pendingCount > 1 ? 's' : ''} pendiente{pendingCount > 1 ? 's' : ''}
            </Text>
          </Animated.View>
        )}

        {/* Ranking shortcut — siempre visible, acceso rápido al ranking de la jornada */}
        {matchday?.id && (
          <Animated.View entering={FadeInDown.delay(200).duration(380)}>
            <Pressable
              onPress={() => router.push(`/quiniela/ranking/${matchday.id}?tournamentId=${matchday?.tournament_id ?? ''}` as any)}
              style={({ pressed }) => [
                styles.rankingRow,
                {
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.border,
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
            >
              <View style={[styles.rankingRowIcon, { backgroundColor: '#F59E0B18' }]}>
                <Ionicons name="podium-outline" size={22} color="#F59E0B" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.rankingRowTitle, { color: theme.colors.textPrimary }]}>
                  Ver Ranking de la jornada
                </Text>
                <Text style={[styles.rankingRowSub, { color: theme.colors.textMuted }]}>
                  Compara tu posición con el resto de participantes
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />
            </Pressable>
          </Animated.View>
        )}

        {/* Picks */}
        <View style={styles.sectionTitleRow}>
          <Text style={[styles.sectionTitle, { color: theme.colors.textPrimary }]}>Tus Pronósticos</Text>
          <Text style={[styles.sectionSub, { color: theme.colors.textMuted }]}>
            {picks.length} {picks.length === 1 ? 'apuesta' : 'apuestas'}
          </Text>
        </View>

        {picks.map((pick: any, index: number) => {
          const match   = pick?.match;
          const teamA   = match?.team_a;
          const teamB   = match?.team_b;
          const pickVal = pick?.pick;
          const isCor   = pick?.is_correct;
          const matchStarted = match?.match_date
            ? new Date(match.match_date).getTime() <= now
            : false;
          const hasScore = match?.score_a != null && match?.score_b != null;

          // Which team did the user pick? Explicit team-name labels for clarity.
          const pickedTeamName =
            pickVal === 'L' ? (teamA?.name ?? 'Local') :
            pickVal === 'V' ? (teamB?.name ?? 'Visitante') :
            pickVal === 'E' ? 'Empate' : '?';
          const pickedTeam =
            pickVal === 'L' ? teamA :
            pickVal === 'V' ? teamB : null;

          let statusIcon: keyof typeof Ionicons.glyphMap = 'time-outline';
          let statusColor = '#F59E0B';
          let statusLabel = matchStarted ? 'En juego' : 'Pendiente';
          if (isCor === true)  { statusIcon = 'checkmark-circle'; statusColor = '#10B981'; statusLabel = 'Acertaste'; }
          if (isCor === false) { statusIcon = 'close-circle';     statusColor = '#EF4444'; statusLabel = 'Fallaste'; }

          return (
            <Animated.View
              key={pick?.id ?? index}
              entering={FadeInDown.delay(240 + index * 55).duration(340).springify()}
            >
              <Pressable
                onPress={canEditBet && !matchStarted ? goEditBet : undefined}
                style={({ pressed }) => [
                  styles.pickCard,
                  { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
                  isCor === true  && { borderColor: '#10B98138' },
                  isCor === false && { borderColor: '#EF444438' },
                  canEditBet && !matchStarted && pressed && { opacity: 0.85 },
                ]}
              >
                <LinearGradient
                  colors={
                    isCor === true  ? ['#10B981', '#059669', 'transparent'] :
                    isCor === false ? ['#EF4444', '#DC2626', 'transparent'] :
                    [theme.colors.primary, theme.colors.primaryLight, 'transparent']
                  }
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  style={{ height: 1.5 }}
                />

                {/* Header: matchup + time */}
                <View style={styles.matchupHeader}>
                  <View style={styles.matchupTeams}>
                    <View style={styles.matchupSide}>
                      <TeamFlag team={teamA} size={22} />
                      <Text style={[styles.matchupTeam, { color: theme.colors.textPrimary }]} numberOfLines={1}>
                        {teamA?.name ?? 'Local'}
                      </Text>
                    </View>
                    {hasScore ? (
                      <Text style={[styles.matchupScore, { color: theme.colors.textPrimary }]}>
                        {match.score_a} - {match.score_b}
                      </Text>
                    ) : (
                      <Text style={[styles.matchupVs, { color: theme.colors.textMuted }]}>vs</Text>
                    )}
                    <View style={[styles.matchupSide, { justifyContent: 'flex-end' }]}>
                      <Text style={[styles.matchupTeam, { color: theme.colors.textPrimary, textAlign: 'right' }]} numberOfLines={1}>
                        {teamB?.name ?? 'Visitante'}
                      </Text>
                      <TeamFlag team={teamB} size={22} />
                    </View>
                  </View>
                  {match?.match_date && (
                    <Text style={[styles.matchupTime, { color: theme.colors.textMuted }]}>
                      <Ionicons name="time-outline" size={11} color={theme.colors.textMuted} />
                      {'  '}{formatMatchTime(match.match_date)}
                    </Text>
                  )}
                </View>

                {/* User's pick — explicit team name */}
                <View style={[styles.pickFooter, { borderTopColor: theme.colors.border }]}>
                  <View style={styles.pickedRow}>
                    <Text style={[styles.pickedLabel, { color: theme.colors.textMuted }]}>
                      APOSTASTE POR:
                    </Text>
                    <View style={styles.pickedTeam}>
                      {pickedTeam && <TeamFlag team={pickedTeam} size={18} />}
                      <Text style={[styles.pickedTeamName, { color: statusColor }]} numberOfLines={1}>
                        {pickedTeamName}
                      </Text>
                    </View>
                  </View>
                  <View style={[styles.statusPill, { backgroundColor: statusColor + '18', borderColor: statusColor + '50' }]}>
                    <Ionicons name={statusIcon} size={13} color={statusColor} />
                    <Text style={[styles.statusPillText, { color: statusColor }]}>
                      {statusLabel}
                    </Text>
                  </View>
                </View>

                {canEditBet && !matchStarted && (
                  <View style={[styles.editHint, { borderTopColor: theme.colors.border }]}>
                    <Ionicons name="create-outline" size={12} color={theme.colors.primaryLight} />
                    <Text style={[styles.editHintText, { color: theme.colors.primaryLight }]}>
                      Toca para cambiar esta selección
                    </Text>
                  </View>
                )}
                {canEditBet && matchStarted && (
                  <View style={[styles.editHint, { borderTopColor: theme.colors.border, backgroundColor: '#EF444408' }]}>
                    <Ionicons name="lock-closed" size={12} color="#EF4444" />
                    <Text style={[styles.editHintText, { color: '#EF4444' }]}>
                      Este partido ya inició · selección bloqueada
                    </Text>
                  </View>
                )}
              </Pressable>
            </Animated.View>
          );
        })}



        <View style={{ height: 60 }} />
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
  headerTitle: { fontSize: 20, fontFamily: 'Poppins_700Bold', color: '#fff', letterSpacing: -0.3 },
  headerSub:   { fontSize: 12, fontFamily: 'Poppins_400Regular', color: 'rgba(255,255,255,0.6)', marginTop: 1 },

  scrollContent: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 60 },

  statsCard: {
    borderRadius: 18, borderWidth: 1, overflow: 'hidden',
    marginBottom: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18, shadowRadius: 12, elevation: 5,
  },
  statsRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 18 },
  statItem: { flex: 1, alignItems: 'center' },
  statNum:  { fontSize: 16, fontFamily: 'Poppins_700Bold', letterSpacing: -0.2 },
  statLabel: { fontSize: 11, fontFamily: 'Poppins_400Regular', marginTop: 3 },
  statDiv:  { width: 1, height: 36 },

  scoreBar: {
    flexDirection: 'row', justifyContent: 'center',
    gap: 24, marginBottom: 16,
  },
  scoreItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  scoreText: { fontSize: 13, fontFamily: 'Poppins_600SemiBold' },

  pendingBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    padding: 12, borderRadius: 12, borderWidth: 1,
    marginBottom: 16,
  },
  pendingText: { fontSize: 12, fontFamily: 'Poppins_500Medium' },

  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 12,
    marginTop: 4,
  },
  sectionTitle: { fontSize: 16, fontFamily: 'Poppins_700Bold', letterSpacing: -0.2 },
  sectionSub:   { fontSize: 12, fontFamily: 'Poppins_500Medium' },

  // Quick edit CTA banner at the top
  editCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 16,
  },
  editCtaIcon: {
    width: 40, height: 40, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  editCtaTitle: { fontSize: 14, fontFamily: 'Poppins_700Bold' },
  editCtaSub:   { fontSize: 11, fontFamily: 'Poppins_400Regular', marginTop: 2, lineHeight: 14 },

  // Pick card (one per match)
  pickCard: {
    borderRadius: 14, borderWidth: 1, overflow: 'hidden',
    marginBottom: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1, shadowRadius: 6, elevation: 3,
  },

  // Matchup header (teams + time)
  matchupHeader: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 10,
  },
  matchupTeams: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  matchupSide: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  matchupTeam:  { flex: 1, fontSize: 13, fontFamily: 'Poppins_600SemiBold' },
  matchupVs:    { fontSize: 11, fontFamily: 'Poppins_400Regular', textAlign: 'center', minWidth: 22 },
  matchupScore: { fontSize: 15, fontFamily: 'Poppins_700Bold', textAlign: 'center', minWidth: 50 },
  matchupTime:  { fontSize: 11, fontFamily: 'Poppins_500Medium', marginTop: 6, textAlign: 'center' as const },

  // User's pick footer
  pickFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: 1,
    gap: 10,
  },
  pickedRow: { flex: 1, flexDirection: 'column', gap: 2 },
  pickedLabel: {
    fontSize: 9,
    fontFamily: 'Poppins_700Bold',
    letterSpacing: 0.8,
  },
  pickedTeam: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pickedTeamName: {
    fontSize: 14,
    fontFamily: 'Poppins_700Bold',
    letterSpacing: -0.2,
    flex: 1,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
  },
  statusPillText: { fontSize: 11, fontFamily: 'Poppins_600SemiBold' },

  // Inline "tap to change" hint when editable
  editHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderTopWidth: 1,
    justifyContent: 'center',
  },
  editHintText: { fontSize: 11, fontFamily: 'Poppins_500Medium' },

  // Header action icon buttons (edit)
  headerActionBtn: {
    width: 38, height: 38, borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center', justifyContent: 'center',
  },

  // Ranking shortcut row (replaces old bottom button)
  rankingRow: {
    flexDirection: 'row' as const,
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  rankingRowIcon: {
    width: 42, height: 42, borderRadius: 12,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  rankingRowTitle: {
    fontSize: 14,
    fontFamily: 'Poppins_700Bold',
  },
  rankingRowSub: {
    fontSize: 11,
    fontFamily: 'Poppins_400Regular',
    marginTop: 2,
  },

  // Estado de error / boleto-no-encontrado recuperable
  notFoundBody: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
    gap: 16,
  },
  notFoundText: {
    fontSize: 14,
    fontFamily: 'Poppins_500Medium',
    textAlign: 'center',
    lineHeight: 20,
  },
  notFoundActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  notFoundBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 12,
  },
  notFoundBtnText: {
    fontSize: 13,
    fontFamily: 'Poppins_600SemiBold',
    color: '#fff',
  },
});
