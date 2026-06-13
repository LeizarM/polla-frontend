import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Pressable,
  Platform,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import Animated, {
  FadeInDown, FadeIn, ZoomIn,
  useSharedValue, useAnimatedStyle, withRepeat, withTiming, Easing,
} from 'react-native-reanimated';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Skeleton } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import { TeamFlag } from '../../components/ui/TeamFlag';
import { useToast } from '../../components/ui/Toast';
import { useAuthStore } from '../../store/authStore';
import { useTheme } from '../../contexts/ThemeContext';
import { theme as staticTheme } from '../../constants/theme';
import api from '../../services/api';
import { formatMoney } from '../../utils/currency';
import { parseBackendDate, toDDMMYYYY } from '../../utils/date';

const POSITIONS = [
  { key: 'pick_1st' as const, label: '1° Lugar', short: '1°', pts: '12 pts', emoji: '🥇', color: '#FFD700', bg: 'rgba(255,215,0,0.12)' },
  { key: 'pick_2nd' as const, label: '2° Lugar', short: '2°', pts: '8 pts',  emoji: '🥈', color: '#C0C0C0', bg: 'rgba(192,192,192,0.12)' },
  { key: 'pick_3rd' as const, label: '3° Lugar', short: '3°', pts: '4 pts',  emoji: '🥉', color: '#CD7F32', bg: 'rgba(205,127,50,0.12)' },
  { key: 'pick_4th' as const, label: '4° Lugar', short: '4°', pts: '2 pts',  emoji: '4️⃣', color: '#94A3B8', bg: 'rgba(148,163,184,0.10)' },
];

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function AdminParticiparScreen() {
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { user } = useAuthStore();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<'apuestas' | 'polla'>('apuestas');
  const [showBetModal, setShowBetModal] = useState(false);
  const [selectedTournament, setSelectedTournament] = useState<any>(null);

  const { data: matchdays, isLoading: matchdaysLoading, refetch: refetchMatchdays } = useQuery({
    queryKey: ['admin-my-matchdays'],
    queryFn: async () => {
      // upcoming=true → jornadas visibles desde 1 día antes (igual que el usuario)
      const res = await api.get('/api/matchdays?upcoming=true');
      return res?.data ?? [];
    },
  });

  const { data: myTickets, refetch: refetchTickets } = useQuery({
    queryKey: ['admin-my-tickets'],
    queryFn: async () => {
      const res = await api.get('/api/tickets/me');
      return res?.data ?? [];
    },
  });

  const { data: myBets, refetch: refetchBets } = useQuery({
    queryKey: ['admin-my-final-bets'],
    queryFn: async () => {
      const res = await api.get('/api/final-bets/me');
      return res?.data ?? [];
    },
  });

  const { data: tournaments, isLoading: loadingTournaments, refetch: refetchTournaments } = useQuery({
    queryKey: ['admin-tournaments-participate'],
    queryFn: async () => {
      const res = await api.get('/api/tournaments?status=active');
      return res?.data ?? [];
    },
  });

  useFocusEffect(useCallback(() => {
    refetchMatchdays();
    refetchTickets();
    refetchBets();
    refetchTournaments();
  }, []));

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refetchMatchdays(), refetchTickets(), refetchBets(), refetchTournaments()]);
    setRefreshing(false);
  };

  // Mostramos TODAS las jornadas: abiertas (para apostar) + finalizadas (para ver
  // la tabla/ranking) — paridad con la pestaña "Apuestas" del usuario normal.
  const visibleMatchdays = [...(matchdays ?? [])].sort((a: any, b: any) => {
    const ao = a?.status === 'open' ? 0 : 1;
    const bo = b?.status === 'open' ? 0 : 1;
    if (ao !== bo) return ao - bo;                                    // abiertas primero
    return String(b?.date ?? '').localeCompare(String(a?.date ?? '')); // luego fecha desc
  });
  const ticketMap = new Map<string, any>();
  (myTickets ?? []).forEach((t: any) => { ticketMap.set(t?.matchday_id, t); });

  const betByTournament = new Map<string, any>();
  (myBets ?? []).forEach((b: any) => { betByTournament.set(b?.tournament_id, b); });

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <LinearGradient
        colors={[theme.colors.primary, theme.colors.primaryLight]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.6, y: 1 }}
        style={styles.headerGradient}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="ticket-outline" size={20} color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Apostar</Text>
            <Text style={styles.headerSubtitle}>Apuestas del administrador</Text>
          </View>
        </View>
      </LinearGradient>

      {/* Tab Selector */}
      <View style={styles.tabRow}>
        <Pressable
          style={[styles.tabBtn, tab === 'apuestas' && styles.tabBtnActive]}
          onPress={() => setTab('apuestas')}
        >
          <Ionicons name="trophy-outline" size={16} color={tab === 'apuestas' ? theme.colors.primaryLight : theme.colors.textMuted} />
          <Text style={[styles.tabText, tab === 'apuestas' && styles.tabTextActive]}>Apuestas</Text>
        </Pressable>
        <Pressable
          style={[styles.tabBtn, tab === 'polla' && styles.tabBtnActive]}
          onPress={() => setTab('polla')}
        >
          <Ionicons name="podium" size={16} color={tab === 'polla' ? '#FFD700' : theme.colors.textMuted} />
          <Text style={[styles.tabText, tab === 'polla' && styles.tabTextActive, tab === 'polla' && { color: '#FFD700' }]}>
            Polla Final
          </Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primaryLight} />}
      >
        {tab === 'apuestas' ? (
          /* ── Apuestas Tab ─────────────────────────────────────────────── */
          matchdaysLoading ? (
            [1, 2, 3].map(i => <Skeleton key={i} width="100%" height={80} style={{ marginBottom: 12 }} />)
          ) : (visibleMatchdays?.length ?? 0) === 0 ? (
            <EmptyState icon="football-outline" title="Sin jornadas" description="No hay jornadas en este momento" />
          ) : (
            visibleMatchdays.map((md: any, idx: number) => {
              const hasTicket = ticketMap.has(md?.id);
              return (
                <Animated.View key={md?.id} entering={FadeInDown.delay(idx * 80)}>
                  <Pressable onPress={() => router.push(
                    (md?.status === 'open'
                      ? `/quiniela/${md?.id}`
                      : `/quiniela/ranking/${md?.id}?tournamentId=${md?.tournament_id ?? md?.tournament?.id ?? ''}`) as any,
                  )}>
                    <Card style={styles.card}>
                      <View style={styles.cardRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.cardTitle}>{md?.name}</Text>
                          <Text style={styles.cardSub}>{md?.tournament?.name ?? 'Torneo'}</Text>
                          <Text style={styles.cardDate}>
                            {(() => { const d = parseBackendDate(md?.date); return d ? toDDMMYYYY(d) : ''; })()}
                            {' · '}{
                              Number(
                                md?.matches?.length
                                ?? md?._count?.matches
                                ?? md?.match_count
                                ?? 0,
                              )
                            } partidos
                          </Text>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                          {md?.status === 'open'
                            ? <Badge status={hasTicket ? 'approved' : 'pending'} text={hasTicket ? 'Apostado' : 'Pendiente'} />
                            : <Badge status={'finished' as any} text="Finalizada" />}
                          <Text style={styles.poolText}>Pozo: {formatMoney(md?.expected_pool ?? md?.total_pool ?? 0, md?.tournament?.currency ?? 'Bs')}</Text>
                        </View>
                      </View>
                    </Card>
                  </Pressable>
                </Animated.View>
              );
            })
          )
        ) : (
          /* ── Polla Final Tab ──────────────────────────────────────────── */
          loadingTournaments ? (
            [1, 2].map(i => <Skeleton key={i} width="100%" height={220} style={{ marginBottom: 16 }} />)
          ) : (tournaments?.length ?? 0) === 0 ? (
            <EmptyState icon="star-outline" title="Sin torneos activos" description="No hay torneos disponibles para la polla final" />
          ) : (
            (tournaments ?? []).map((t: any, idx: number) => {
              const myBet = betByTournament.get(t?.id);
              return (
                <Animated.View key={t?.id} entering={FadeInDown.delay(idx * 100).duration(400)}>
                  <PollaTournamentCard
                    tournament={t}
                    myBet={myBet}
                    onBet={() => {
                      setSelectedTournament(t);
                      setShowBetModal(true);
                    }}
                  />
                </Animated.View>
              );
            })
          )
        )}
      </ScrollView>

      {/* Polla Final Bet Modal */}
      {showBetModal && selectedTournament && (
        <BetModal
          visible={showBetModal}
          tournament={selectedTournament}
          onClose={() => setShowBetModal(false)}
          onSuccess={() => {
            setShowBetModal(false);
            refetchBets();
            queryClient.invalidateQueries({ queryKey: ['admin-my-final-bets'] });
          }}
        />
      )}
    </SafeAreaView>
  );
}

// ─── Polla Tournament Card ────────────────────────────────────────────────────

function PollaTournamentCard({ tournament: t, myBet, onBet }: { tournament: any; myBet: any; onBet: () => void }) {
  const { theme } = useTheme();
  const cardStyles = useMemo(() => makeCardStyles(theme), [theme]);
  const hasBet = !!myBet;
  // Deadline de la Polla Final: una vez pasado, NADIE puede apostar. El backend
  // ya lo rechaza (create + update); acá lo reflejamos en la UI para que el
  // botón quede bloqueado y no genere un error feo. (Blindaje doble.)
  const deadline = t?.final_bet_deadline ? new Date(t.final_bet_deadline) : null;
  const isPastDeadline = !!deadline && new Date() > deadline;

  // ── Shimmer dorado que barre el pozo (efecto "lingote reluciente") ───────────
  const SCREEN_W = Dimensions.get('window').width;
  const shine = useSharedValue(0);
  useEffect(() => {
    shine.value = withRepeat(
      withTiming(1, { duration: 2200, easing: Easing.inOut(Easing.ease) }),
      -1,
      false,
    );
  }, []);
  const shineStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: -120 + shine.value * (SCREEN_W + 120) },
      { skewX: '-22deg' },
    ],
  }));

  const { data: teams } = useQuery({
    queryKey: ['teams'],
    queryFn: async () => { const res = await api.get('/api/teams'); return res?.data ?? []; },
    staleTime: 60000,
  });

  const getTeam = (id?: string) => (teams ?? []).find((tt: any) => tt?.id === id);

  // Reporte de la Polla Final → detecta ganador(es) del premio gordo cuando ya
  // se resolvió. Solo se usa acá (panel admin), así que el cartel es admin-only.
  const { data: pollaReport } = useQuery({
    queryKey: ['polla-report-card', t?.id],
    queryFn: async () => {
      try { const res = await api.get(`/api/final-bets/tournament/${t?.id}/report`); return res?.data ?? null; }
      catch { return null; }
    },
    enabled: !!t?.id,
    staleTime: 30000,
  });
  const winners = ((pollaReport?.bets ?? []) as any[]).filter((b) => b?.status === 'won');
  const isResolved = winners.length > 0;

  // ── Prize math: jornadas × inscritos × bet_final ─────────────────────────────
  const jornadasCount    = Number(t?._count?.matchdays    ?? t?.matchdays?.length ?? 0);
  // Solo cuentan los APROBADOS (no pendientes/rechazados) para el pozo
  const inscritosCount   = Number(t?.approved_participants ?? t?._count?.participants ?? t?.participants?.length ?? 0);
  const betFinal         = Number(t?.bet_final ?? 0);
  const grandPrize       = jornadasCount * inscritosCount * betFinal;
  const currency         = t?.currency ?? 'Bs';

  return (
    <View style={cardStyles.wrapper}>
      {/* Premium gold-tinted gradient header */}
      <LinearGradient
        colors={['#0D1B2E', '#1D4ED8', '#0D1B2E']}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={cardStyles.gradientHeader}
      >
        <View style={cardStyles.headerTop}>
          <View style={cardStyles.titleRow}>
            <Text style={cardStyles.trophy}>🏆</Text>
            <View style={{ flex: 1 }}>
              <Text style={cardStyles.pollaLabel}>POLLA FINAL · PREMIO GORDO</Text>
              <Text style={cardStyles.tournamentName}>{t?.name}</Text>
            </View>
          </View>
          {hasBet ? (
            <View style={cardStyles.apostadoBadge}>
              <Ionicons name="checkmark-circle" size={14} color="#10B981" />
              <Text style={cardStyles.apostadoText}>Apostado</Text>
            </View>
          ) : (
            <View style={cardStyles.pendienteBadge}>
              <Ionicons name="time-outline" size={14} color="#F59E0B" />
              <Text style={cardStyles.pendienteText}>Pendiente</Text>
            </View>
          )}
        </View>

        {/* ─── Cartel GANADOR del premio gordo (cuando ya se resolvió) ──── */}
        {isResolved && (
          <View style={{ marginTop: 12, borderRadius: 14, overflow: 'hidden', borderWidth: 1.5, borderColor: '#FFD700' }}>
            <LinearGradient colors={['rgba(255,215,0,0.18)', 'rgba(255,165,0,0.08)', 'transparent']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ padding: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <Text style={{ fontSize: 16 }}>🏆</Text>
                <Text style={{ color: '#FFD700', fontFamily: 'Poppins_800ExtraBold', fontSize: 12, letterSpacing: 0.5 }}>
                  GANADOR{winners.length > 1 ? 'ES' : ''} DEL PREMIO GORDO
                </Text>
              </View>
              {winners.map((w, i) => (
                <View key={i} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 3 }}>
                  <Text style={{ color: '#fff', fontFamily: 'Poppins_700Bold', fontSize: 14, flex: 1 }} numberOfLines={1}>
                    {w?.full_name ?? 'Participante'}
                  </Text>
                  <Text style={{ color: 'rgba(255,255,255,0.85)', fontFamily: 'Poppins_600SemiBold', fontSize: 12, marginHorizontal: 8 }}>
                    {w?.total_points ?? 0} pts
                  </Text>
                  <Text style={{ color: '#34D399', fontFamily: 'Poppins_800ExtraBold', fontSize: 14 }}>
                    {currency} {Number(w?.prize_won ?? 0).toFixed(2)}
                  </Text>
                </View>
              ))}
            </LinearGradient>
          </View>
        )}

        {/* ─── POZO TOTAL — joya dorada (lingote reluciente) ───────────── */}
        <View style={[cardStyles.prizeBox, { shadowColor: '#FFD700', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.7, shadowRadius: 22, elevation: 18 }]}>
          <LinearGradient
            colors={['#FFE680', '#FFD700', '#FFA500', '#D4A017']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={cardStyles.prizeGradient}
          >
            <View style={cardStyles.prizeLabelRow}>
              <Ionicons name="trophy" size={13} color="#7B5A00" />
              <Text style={cardStyles.prizeLabel}>POZO TOTAL</Text>
            </View>
            <Text style={cardStyles.prizeValue}>
              {currency} {grandPrize}
            </Text>
            <Text style={cardStyles.prizeFormula}>
              {jornadasCount} jornadas × {inscritosCount} inscritos × {currency} {betFinal}
            </Text>
          </LinearGradient>
          {/* Shimmer dorado que barre el pozo */}
          <Animated.View pointerEvents="none" style={[cardStyles.prizeShine, shineStyle]}>
            <LinearGradient
              colors={['transparent', 'rgba(255,255,255,0.65)', 'transparent']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={{ flex: 1 }}
            />
          </Animated.View>
        </View>

        {/* Tie-split note */}
        <View style={cardStyles.tieNote}>
          <Ionicons name="information-circle" size={11} color="rgba(255,215,0,0.85)" />
          <Text style={cardStyles.tieNoteText}>
            Si hay empate, el pozo se reparte entre los ganadores
          </Text>
        </View>

        {/* ─── PODIO — escenario escalonado (1° más alto) con peana y numeral ──
            Es el héroe interactivo: la altura de cada escalón codifica los puntos. */}
        {hasBet ? (
          <View style={cardStyles.podiumStage}>
            {POSITIONS.map((pos, idx) => {
              const team = getTeam(myBet?.[pos.key]);
              const h = [150, 120, 100, 86][idx];
              const first = idx === 0;
              return (
                <View key={pos.key} style={cardStyles.podiumCol}>
                  <View style={[
                    cardStyles.podiumSlot,
                    { height: h, borderColor: pos.color + '80', backgroundColor: pos.color + '1A' },
                    first && cardStyles.podiumSlotFirst,
                    first && { shadowColor: pos.color },
                  ]}>
                    <Text style={{ fontSize: first ? 26 : 20 }}>{pos.emoji}</Text>
                    {team ? (
                      <>
                        <TeamFlag team={team} size={first ? 34 : 26} />
                        <Text style={[cardStyles.podiumTeamName, { color: pos.color, fontSize: first ? 12 : 11 }]} numberOfLines={1}>
                          {team?.name}
                        </Text>
                      </>
                    ) : (
                      <Text style={cardStyles.podiumEmpty}>—</Text>
                    )}
                    <Text style={cardStyles.podiumPts}>{pos.pts}</Text>
                  </View>
                  <View style={[cardStyles.plinth, { backgroundColor: pos.color + '26', borderColor: pos.color + '66' }]}>
                    <Text style={[cardStyles.plinthNum, { color: pos.color }]}>{pos.short}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        ) : (
          /* Escenario vacío — TOCABLE para apostar (salvo deadline pasado) */
          <Pressable onPress={isPastDeadline ? undefined : onBet} disabled={isPastDeadline}>
            <View style={cardStyles.podiumStage}>
              {POSITIONS.map((pos, idx) => {
                const h = [150, 120, 100, 86][idx];
                const first = idx === 0;
                return (
                  <View key={pos.key} style={cardStyles.podiumCol}>
                    <View style={[
                      cardStyles.podiumSlot, cardStyles.podiumSlotEmpty,
                      { height: h, borderColor: pos.color + '66', backgroundColor: pos.color + '12' },
                      first && cardStyles.podiumSlotFirst,
                      first && { shadowColor: pos.color },
                    ]}>
                      <Text style={{ fontSize: first ? 30 : 22 }}>{pos.emoji}</Text>
                      <View style={[
                        cardStyles.pickAffordance,
                        { borderColor: pos.color + '99' },
                        first && { width: 30, height: 30, borderRadius: 15 },
                      ]}>
                        <Ionicons name="add" size={first ? 20 : 15} color={pos.color} />
                      </View>
                      <Text style={cardStyles.podiumPts}>{pos.pts}</Text>
                    </View>
                    <View style={[cardStyles.plinth, { backgroundColor: pos.color + '1F', borderColor: pos.color + '55' }]}>
                      <Text style={[cardStyles.plinthNum, { color: pos.color }]}>{pos.short}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
            <View style={cardStyles.podiumHint}>
              <Ionicons name={isPastDeadline ? 'lock-closed' : 'hand-left-outline'} size={13} color={isPastDeadline ? '#F87171' : 'rgba(255,255,255,0.6)'} />
              <Text style={[cardStyles.podiumHintText, { color: isPastDeadline ? '#F87171' : 'rgba(255,255,255,0.6)' }]}>
                {isPastDeadline ? 'Apuestas cerradas — pasó la fecha límite' : 'Toca para armar tu podio'}
              </Text>
            </View>
          </Pressable>
        )}
      </LinearGradient>

      {/* Bottom action */}
      <View style={cardStyles.footer}>
        {hasBet ? (
          /* Pts summary */
          <View style={cardStyles.ptsRow}>
            {POSITIONS.map((pos) => (
              <View key={pos.key} style={[cardStyles.ptsBadge, { backgroundColor: pos.bg }]}>
                <Text style={[cardStyles.ptsValue, { color: pos.color }]}>{pos.pts}</Text>
                <Text style={cardStyles.ptsLabel}>{pos.short}</Text>
              </View>
            ))}
            {myBet?.status === 'won' && (
              <View style={cardStyles.wonBanner}>
                <Ionicons name="trophy" size={14} color="#FFD700" />
                <Text style={cardStyles.wonText}>
                  ¡Ganaste {currency} {Number(myBet?.prize_won ?? 0).toFixed(2)}!
                </Text>
              </View>
            )}
          </View>
        ) : isPastDeadline ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(239,68,68,0.35)', backgroundColor: 'rgba(239,68,68,0.10)' }}>
            <Ionicons name="lock-closed" size={18} color="#EF4444" />
            <Text style={{ color: '#EF4444', fontFamily: 'Poppins_700Bold', fontSize: 15 }}>Apuestas cerradas (pasó la fecha límite)</Text>
          </View>
        ) : (
          <Pressable style={cardStyles.betCta} onPress={onBet}>
            <LinearGradient
              colors={['#E11D48', '#BE123C']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={cardStyles.betCtaGradient}
            >
              <Text style={cardStyles.betCtaIcon}>⭐</Text>
              <Text style={cardStyles.betCtaText}>Hacer mi Predicción</Text>
              <Ionicons name="chevron-forward" size={18} color="#fff" />
            </LinearGradient>
          </Pressable>
        )}
      </View>
    </View>
  );
}

// ─── Bet Modal ────────────────────────────────────────────────────────────────

function BetModal({ visible, tournament, onClose, onSuccess }: {
  visible: boolean;
  tournament: any;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { theme } = useTheme();
  const modalStyles = useMemo(() => makeModalStyles(theme), [theme]);
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [picks, setPicks] = useState<Record<string, string>>({
    pick_1st: '', pick_2nd: '', pick_3rd: '', pick_4th: '',
  });

  const { data: quarterTeams, isLoading: loadingTeams } = useQuery({
    queryKey: ['quarter-teams', tournament?.id],
    queryFn: async () => {
      const res = await api.get(`/api/tournaments/${tournament?.id}/quarter-teams`);
      return res?.data ?? [];
    },
    enabled: !!tournament?.id,
  });

  const selectedIds = Object.values(picks).filter(Boolean);
  const filledCount = selectedIds.length;
  const allSelected = filledCount === 4;

  const togglePick = (posKey: string, teamId: string) => {
    if (Platform.OS !== 'web') Haptics.impactAsync?.(Haptics.ImpactFeedbackStyle.Light);
    const current = picks[posKey];
    setPicks({ ...picks, [posKey]: current === teamId ? '' : teamId });
  };

  const handleSubmit = async () => {
    if (!allSelected) { showToast('error', 'Selecciona los 4 equipos'); return; }
    if (Platform.OS !== 'web') Haptics.notificationAsync?.(Haptics.NotificationFeedbackType.Success);
    setLoading(true);
    try {
      await api.post('/api/final-bets', { tournament_id: tournament?.id, ...picks });
      showToast('success', '¡Predicción guardada! ⭐');
      onSuccess();
    } catch (error: any) {
      showToast('error', error?.response?.data?.message || 'Error al guardar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} onClose={onClose}>
      {/* Modal header */}
      <LinearGradient
        colors={['rgba(29,78,216,0.3)', 'transparent']}
        style={modalStyles.modalHeader}
      >
        <Text style={modalStyles.modalTitle}>🏆 Polla Final</Text>
        <Text style={modalStyles.modalTournament}>{tournament?.name}</Text>

        {/* Progress pills */}
        <View style={modalStyles.progressRow}>
          {POSITIONS.map((pos, i) => {
            const filled = !!picks[pos.key];
            return (
              <View
                key={pos.key}
                style={[
                  modalStyles.progressPill,
                  filled && { backgroundColor: pos.color, borderColor: pos.color },
                ]}
              >
                <Text style={[modalStyles.progressPillText, filled && { color: '#000' }]}>
                  {filled ? '✓' : pos.emoji}
                </Text>
              </View>
            );
          })}
          <Text style={modalStyles.progressLabel}>
            {filledCount}/4 seleccionados
          </Text>
        </View>
      </LinearGradient>

      {loadingTeams ? (
        <View style={{ gap: 8, marginTop: 8 }}>
          {[1,2,3,4].map(i => <Skeleton key={i} width="100%" height={50} />)}
        </View>
      ) : (quarterTeams?.length ?? 0) < 4 ? (
        <View style={modalStyles.notEnoughBox}>
          <Text style={{ fontSize: 40 }}>⚠️</Text>
          <Text style={modalStyles.notEnoughTitle}>Equipos insuficientes</Text>
          <Text style={modalStyles.notEnoughSub}>
            Aún no hay equipos en cuartos de final ({quarterTeams?.length ?? 0}/8)
          </Text>
        </View>
      ) : (
        <>
          {POSITIONS.map((pos) => {
            const selectedTeam = (quarterTeams ?? []).find((t: any) => t?.id === picks[pos.key]);
            return (
              <View key={pos.key} style={[modalStyles.posBlock, { borderLeftColor: picks[pos.key] ? pos.color : 'transparent' }]}>
                {/* Position header */}
                <View style={modalStyles.posHeader}>
                  <Text style={modalStyles.posEmoji}>{pos.emoji}</Text>
                  <Text style={modalStyles.posLabel}>{pos.label}</Text>
                  <View style={[modalStyles.ptsBadge, { backgroundColor: pos.bg }]}>
                    <Text style={[modalStyles.ptsText, { color: pos.color }]}>{pos.pts}</Text>
                  </View>
                  {selectedTeam && (
                    <Animated.View entering={ZoomIn.duration(200)} style={[modalStyles.selectedPill, { backgroundColor: pos.color + '25', borderColor: pos.color }]}>
                      <TeamFlag team={selectedTeam} size={16} />
                      <Text style={[modalStyles.selectedPillText, { color: pos.color }]} numberOfLines={1}>
                        {selectedTeam?.name}
                      </Text>
                    </Animated.View>
                  )}
                </View>

                {/* Team grid — 2 columns */}
                <View style={modalStyles.teamGrid}>
                  {(quarterTeams ?? []).map((team: any) => {
                    const isSelected = picks[pos.key] === team?.id;
                    const isUsed = selectedIds.includes(team?.id) && !isSelected;
                    return (
                      <Pressable
                        key={team?.id}
                        disabled={isUsed}
                        onPress={() => togglePick(pos.key, team?.id)}
                        style={[
                          modalStyles.teamTile,
                          isSelected && [modalStyles.teamTileSelected, { borderColor: pos.color, backgroundColor: pos.bg }],
                          isUsed && modalStyles.teamTileDisabled,
                        ]}
                      >
                        <TeamFlag team={team} size={24} />
                        <Text
                          style={[
                            modalStyles.teamTileText,
                            isSelected && { color: pos.color, fontFamily: 'Poppins_700Bold' },
                            isUsed && { color: theme.colors.textMuted },
                          ]}
                          numberOfLines={1}
                        >
                          {team?.name}
                        </Text>
                        {isSelected && (
                          <Ionicons name="checkmark-circle" size={16} color={pos.color} style={{ marginLeft: 'auto' as any }} />
                        )}
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            );
          })}

          {/* Summary when all picked */}
          {allSelected && (
            <Animated.View entering={FadeIn.duration(300)} style={modalStyles.summary}>
              <Text style={modalStyles.summaryTitle}>✅ Tu predicción final</Text>
              <View style={modalStyles.summaryGrid}>
                {POSITIONS.map(pos => {
                  const team = (quarterTeams ?? []).find((t: any) => t?.id === picks[pos.key]);
                  return (
                    <View key={pos.key} style={[modalStyles.summarySlot, { borderColor: pos.color + '40' }]}>
                      <Text style={modalStyles.summaryEmoji}>{pos.emoji}</Text>
                      {team && <TeamFlag team={team} size={26} />}
                      <Text style={[modalStyles.summaryTeam, { color: pos.color }]} numberOfLines={2}>
                        {team?.name ?? '?'}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </Animated.View>
          )}

          <Button
            title={allSelected ? '🎯 Confirmar Predicción' : `Selecciona ${4 - filledCount} posición${4 - filledCount !== 1 ? 'es' : ''} más`}
            variant={allSelected ? 'accent' : 'outline'}
            size="lg"
            fullWidth
            onPress={handleSubmit}
            loading={loading}
            disabled={!allSelected}
            style={{ marginTop: 16 }}
          />
        </>
      )}
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

function makeStyles(t: typeof staticTheme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: t.colors.bg },
    headerGradient: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 22 },
    headerTitle: { fontSize: 22, fontFamily: 'Poppins_800ExtraBold', color: '#fff', letterSpacing: -0.4 },
    headerSubtitle: { fontSize: 12, fontFamily: 'Poppins_400Regular', color: 'rgba(255,255,255,0.6)', marginTop: 3 },
    tabRow: {
      flexDirection: 'row', paddingHorizontal: 20, paddingVertical: 8, gap: 8,
    },
    tabBtn: {
      flex: 1, flexDirection: 'row', alignItems: 'center',
      justifyContent: 'center', paddingVertical: 10,
      borderRadius: 10, backgroundColor: t.colors.surface, gap: 6,
    },
    tabBtnActive: {
      backgroundColor: 'rgba(0,82,204,0.2)', borderWidth: 1, borderColor: t.colors.primaryLight,
    },
    tabText: { color: t.colors.textMuted, fontFamily: 'Poppins_600SemiBold', fontSize: 14 },
    tabTextActive: { color: t.colors.primaryLight },
    content: { padding: 20, paddingBottom: 80 },
    card: { marginBottom: 14 },
    cardRow: { flexDirection: 'row', alignItems: 'center' },
    cardTitle: { fontSize: 14, fontFamily: 'Poppins_700Bold', color: t.colors.textPrimary },
    cardSub: { fontSize: 12, fontFamily: 'Poppins_400Regular', color: t.colors.textSecondary, marginTop: 2 },
    cardDate: { fontSize: 11, fontFamily: 'Poppins_400Regular', color: t.colors.textMuted, marginTop: 4 },
    poolText: { fontSize: 12, fontFamily: 'Poppins_700Bold', color: t.colors.success, marginTop: 6 },
  });
}

function makeCardStyles(t: typeof staticTheme) {
  return StyleSheet.create({
    wrapper: {
      borderRadius: 18, overflow: 'hidden', marginBottom: 20,
      borderWidth: 1, borderColor: t.colors.border,
      shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.18, shadowRadius: 10, elevation: 5,
      // Responsive: en escritorio NO se estira a lo ancho (se centra); en móvil
      // ocupa todo el ancho disponible (la pantalla siempre es < maxWidth).
      width: '100%', maxWidth: 880, alignSelf: 'center',
    },
    gradientHeader: { padding: 20, paddingBottom: 14, position: 'relative', overflow: 'hidden' },
    orb: {
      position: 'absolute',
      width: 120, height: 120, borderRadius: 60,
    },
    headerTop: {
      flexDirection: 'row', alignItems: 'flex-start',
      justifyContent: 'space-between', marginBottom: 14,
    },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
    trophy: { fontSize: 32 },
    pollaLabel: {
      fontSize: 10,
      fontFamily: 'Poppins_800ExtraBold',
      color: '#FFD700',
      letterSpacing: 1.2,
      marginBottom: 2,
    },
    tournamentName: { fontSize: 17, fontFamily: 'Poppins_700Bold', color: '#FFFFFF' },
    tournamentInfo: { fontSize: 12, fontFamily: 'Poppins_400Regular', color: 'rgba(255,255,255,0.65)', marginTop: 2 },

    // ── BIG PRIZE display ──────────────────────────────────────────────────
    prizeBox: {
      marginVertical: 12,
      borderRadius: 14,
      overflow: 'hidden',
      shadowColor: '#FFD700',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.5,
      shadowRadius: 14,
      elevation: 10,
    },
    prizeGradient: {
      paddingVertical: 16,
      paddingHorizontal: 14,
      alignItems: 'center',
      borderWidth: 1.5,
      borderColor: 'rgba(255,255,255,0.3)',
      borderRadius: 14,
    },
    prizeLabelRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
    },
    prizeLabel: {
      fontSize: 11,
      fontFamily: 'Poppins_800ExtraBold',
      color: '#7B5A00',
      letterSpacing: 1.4,
    },
    prizeValue: {
      fontSize: 46,
      fontFamily: 'Poppins_800ExtraBold',
      color: '#3D2A00',
      letterSpacing: -1.5,
      marginTop: 2,
      textShadowColor: 'rgba(255,255,255,0.5)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 1,
    },
    prizeFormula: {
      fontSize: 11,
      fontFamily: 'Poppins_600SemiBold',
      color: '#5B3F00',
      marginTop: 4,
    },
    prizeShine: {
      position: 'absolute',
      top: -12, bottom: -12,
      left: 0,
      width: 70,
    },
    tieNote: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      justifyContent: 'center',
      marginBottom: 12,
      paddingHorizontal: 6,
    },
    tieNoteText: {
      fontSize: 10,
      fontFamily: 'Poppins_500Medium',
      color: 'rgba(255,215,0,0.85)',
      fontStyle: 'italic' as const,
    },
    apostadoBadge: {
      flexDirection: 'row', alignItems: 'center', gap: 4,
      backgroundColor: 'rgba(16,185,129,0.2)', borderWidth: 1,
      borderColor: 'rgba(16,185,129,0.4)', borderRadius: 999,
      paddingHorizontal: 10, paddingVertical: 4,
    },
    apostadoText: { fontSize: 11, fontFamily: 'Poppins_700Bold', color: '#10B981' },
    pendienteBadge: {
      flexDirection: 'row', alignItems: 'center', gap: 4,
      backgroundColor: 'rgba(245,158,11,0.2)', borderWidth: 1,
      borderColor: 'rgba(245,158,11,0.4)', borderRadius: 999,
      paddingHorizontal: 10, paddingVertical: 4,
    },
    pendienteText: { fontSize: 11, fontFamily: 'Poppins_700Bold', color: '#F59E0B' },
    // ── Podio: escenario escalonado (slot variable + peana fija) ───────────
    podiumStage: { flexDirection: 'row', gap: 8, alignItems: 'flex-end', marginTop: 10 },
    podiumCol: { flex: 1, gap: 4 },
    podiumSlot: {
      width: '100%', alignItems: 'center', justifyContent: 'center', gap: 4,
      backgroundColor: 'rgba(255,255,255,0.08)',
      borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
      paddingVertical: 10, paddingHorizontal: 4,
    },
    podiumSlotFirst: {
      borderWidth: 1.5,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.6, shadowRadius: 14, elevation: 10,
    },
    podiumSlotEmpty: { borderStyle: 'dashed' as 'dashed' },
    podiumEmoji: { fontSize: 16 },
    podiumTeamName: { fontSize: 10, fontFamily: 'Poppins_700Bold', textAlign: 'center' },
    podiumEmpty: { fontSize: 20, color: 'rgba(255,255,255,0.25)' },
    podiumPts: { fontSize: 10, fontFamily: 'Poppins_700Bold', color: 'rgba(255,255,255,0.65)' },
    pickAffordance: {
      width: 24, height: 24, borderRadius: 12, borderWidth: 1.5,
      borderStyle: 'dashed' as 'dashed',
      alignItems: 'center', justifyContent: 'center', marginVertical: 2,
    },
    // Peana: base fija que unifica los escalones en un podio sobre un mismo piso
    plinth: {
      width: '100%', height: 34, borderRadius: 10, borderWidth: 1,
      alignItems: 'center', justifyContent: 'center',
    },
    plinthNum: { fontSize: 18, fontFamily: 'Poppins_800ExtraBold' },
    podiumHint: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      gap: 6, marginTop: 12,
    },
    podiumHintText: { fontFamily: 'Poppins_600SemiBold', fontSize: 12 },
    footer: { backgroundColor: t.colors.surface, padding: 14 },
    ptsRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
    ptsBadge: { flex: 1, alignItems: 'center', borderRadius: 8, paddingVertical: 6 },
    ptsValue: { fontSize: 12, fontFamily: 'Poppins_700Bold' },
    ptsLabel: { fontSize: 10, fontFamily: 'Poppins_400Regular', color: t.colors.textMuted, marginTop: 1 },
    wonBanner: {
      width: '100%', flexDirection: 'row', alignItems: 'center',
      justifyContent: 'center', gap: 6,
      backgroundColor: 'rgba(255,215,0,0.12)',
      borderRadius: 8, paddingVertical: 8, marginTop: 4,
    },
    wonText: { color: '#FFD700', fontFamily: 'Poppins_700Bold', fontSize: 13 },
    betCta: { borderRadius: 14, overflow: 'hidden' },
    betCtaGradient: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      paddingVertical: 14, gap: 8,
    },
    betCtaIcon: { fontSize: 18 },
    betCtaText: { color: '#FFF', fontFamily: 'Poppins_700Bold', fontSize: 16, flex: 1, textAlign: 'center' },
  });
}

function makeModalStyles(t: typeof staticTheme) {
  return StyleSheet.create({
    modalHeader: {
      alignItems: 'center', paddingTop: 4, paddingBottom: 14,
      marginBottom: 8, borderRadius: 12,
    },
    modalTitle: { fontSize: 20, fontFamily: 'Poppins_700Bold', color: t.colors.textPrimary, textAlign: 'center' },
    modalTournament: { fontSize: 14, fontFamily: 'Poppins_400Regular', color: t.colors.primaryLight, marginTop: 2 },
    progressRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 },
    progressPill: {
      width: 28, height: 28, borderRadius: 14, borderWidth: 1.5,
      borderColor: t.colors.border, backgroundColor: t.colors.surface,
      alignItems: 'center', justifyContent: 'center',
    },
    progressPillText: { fontSize: 12 },
    progressLabel: { fontSize: 12, fontFamily: 'Poppins_400Regular', color: t.colors.textSecondary, marginLeft: 4 },
    notEnoughBox: { alignItems: 'center', padding: 24, gap: 8 },
    notEnoughTitle: { fontSize: 17, fontFamily: 'Poppins_700Bold', color: t.colors.textPrimary },
    notEnoughSub: { fontSize: 14, fontFamily: 'Poppins_400Regular', color: t.colors.textSecondary, textAlign: 'center' },
    posBlock: { marginBottom: 14, borderLeftWidth: 3, paddingLeft: 8 },
    posHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8, flexWrap: 'wrap' },
    posEmoji: { fontSize: 18 },
    posLabel: { fontSize: 14, fontFamily: 'Poppins_600SemiBold', color: t.colors.textPrimary },
    ptsBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
    ptsText: { fontSize: 11, fontFamily: 'Poppins_700Bold' },
    selectedPill: {
      flexDirection: 'row', alignItems: 'center', gap: 4,
      paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999,
      borderWidth: 1, maxWidth: 120,
    },
    selectedPillText: { fontSize: 11, fontFamily: 'Poppins_700Bold', flexShrink: 1 },
    teamGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    teamTile: {
      flexDirection: 'row', alignItems: 'center', gap: 6, width: '47%',
      paddingHorizontal: 10, paddingVertical: 8, borderRadius: 12,
      backgroundColor: t.colors.surfaceElevated, borderWidth: 1.5, borderColor: t.colors.border,
    },
    teamTileSelected: { backgroundColor: 'transparent' },
    teamTileDisabled: { opacity: 0.3 },
    teamTileText: { color: t.colors.textPrimary, fontSize: 12, fontFamily: 'Poppins_500Medium', flexShrink: 1 },
    summary: {
      backgroundColor: 'rgba(255,215,0,0.06)', borderRadius: 16,
      borderWidth: 1, borderColor: 'rgba(255,215,0,0.25)',
      padding: 14, marginTop: 8,
    },
    summaryTitle: { fontSize: 14, fontFamily: 'Poppins_700Bold', color: t.colors.textPrimary, marginBottom: 8, textAlign: 'center' },
    summaryGrid: { flexDirection: 'row', gap: 8 },
    summarySlot: { flex: 1, alignItems: 'center', gap: 4, padding: 8, borderRadius: 12, borderWidth: 1 },
    summaryEmoji: { fontSize: 18 },
    summaryTeam: { fontSize: 11, fontFamily: 'Poppins_700Bold', textAlign: 'center' },
  });
}
