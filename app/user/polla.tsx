import React, { useState, useCallback, useMemo } from 'react';
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
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useFocusEffect } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import Animated, {
  FadeInDown,
  useSharedValue, useAnimatedStyle, withRepeat, withTiming, Easing,
} from 'react-native-reanimated';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Skeleton } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { TeamFlag } from '../../components/ui/TeamFlag';
import { QuarterTeamsBanner } from '../../components/ui/QuarterTeamsBanner';
import { useToast } from '../../components/ui/Toast';
import { useTheme } from '../../contexts/ThemeContext';
import { theme as staticTheme } from '../../constants/theme';
import api from '../../services/api';
import { usePollaFinalEnabled } from '../../hooks/useAppSettings';
import { formatMoney } from '../../utils/currency';
import { Redirect } from 'expo-router';

// Glassmorphism REAL (frosted) solo en web — backdrop-filter no existe en RN nativo.
const GLASS_WEB: any = Platform.OS === 'web'
  ? { backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)' }
  : null;

// Posiciones del podio (campeón → 4°). short = numeral grabado en la peana.
const PODIUM_POS = [
  { key: 'pick_1st' as const, short: '1°', pts: '12 pts', emoji: '🥇', color: '#FFD700' },
  { key: 'pick_2nd' as const, short: '2°', pts: '8 pts',  emoji: '🥈', color: '#C0C0C0' },
  { key: 'pick_3rd' as const, short: '3°', pts: '4 pts',  emoji: '🥉', color: '#CD7F32' },
  { key: 'pick_4th' as const, short: '4°', pts: '2 pts',  emoji: '4️⃣', color: '#94A3B8' },
];

// Wrapper que decide si renderizar la pantalla o redirigir. Mantiene a
// `PollaFinalScreenInner` libre del check para no romper Rules-of-Hooks.
export default function PollaFinalScreenGuard() {
  const { enabled, isLoading } = usePollaFinalEnabled();
  // Mientras carga, mostramos null (no renderiza la pantalla todavía).
  if (isLoading) return null;
  // Defensa en profundidad: aunque el tab esté oculto, alguien podría llegar
  // vía deep-link / URL directa. Redirigimos al home del usuario.
  if (!enabled) return <Redirect href="/user" />;
  return <PollaFinalScreenInner />;
}

function PollaFinalScreenInner() {
  const { theme } = useTheme();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const [refreshing, setRefreshing] = useState(false);
  const [showBetModal, setShowBetModal] = useState(false);
  const [selectedTournament, setSelectedTournament] = useState<any>(null);
  const [showRules, setShowRules] = useState(false);

  // ── Shimmer dorado que barre el premio gordo (mismo efecto que en admin) ─────
  const SCREEN_W = Dimensions.get('window').width;
  const shine = useSharedValue(0);
  React.useEffect(() => {
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

  const { data: tournaments, isLoading: loadingTournaments, refetch: refetchTournaments } = useQuery({
    queryKey: ['active-tournaments-polla'],
    queryFn: async () => {
      try {
        const res = await api.get('/api/tournaments?status=active');
        return res?.data ?? [];
      } catch { return []; }
    },
  });

  const { data: myBets, isLoading: loadingBets, refetch: refetchBets } = useQuery({
    queryKey: ['my-final-bets'],
    queryFn: async () => {
      try {
        const res = await api.get('/api/final-bets/me');
        return res?.data ?? [];
      } catch { return []; }
    },
  });

  // Equipos — para pintar las banderas en el podio cuando ya hay apuesta.
  const { data: teams } = useQuery({
    queryKey: ['teams'],
    queryFn: async () => {
      try { const res = await api.get('/api/teams'); return res?.data ?? []; }
      catch { return []; }
    },
    staleTime: 60000,
  });
  const getTeam = (id?: string) => (teams ?? []).find((tt: any) => tt?.id === id);

  useFocusEffect(useCallback(() => {
    refetchTournaments();
    refetchBets();
  }, []));

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refetchTournaments(), refetchBets()]);
    setRefreshing(false);
  };

  const betByTournament = new Map<string, any>();
  (myBets ?? []).forEach((b: any) => betByTournament.set(b?.tournament_id, b));

  const openBetModal = (t: any) => {
    setSelectedTournament(t);
    setShowBetModal(true);
  };

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
            <Ionicons name="star" size={20} color="#FFD700" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Polla Final</Text>
            <Text style={styles.headerSubtitle}>Predice 1°, 2°, 3° y 4° lugar</Text>
          </View>
        </View>
      </LinearGradient>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primaryLight} />}
      >
        {/* ─── Tarjeta de Reglas (colapsable) ──────────────────────────── */}
        <Card style={{ marginBottom: 12, padding: 0, overflow: 'hidden' }}>
          <Pressable
            onPress={() => setShowRules(v => !v)}
            style={styles.rulesHeader}
          >
            <View style={styles.rulesIconWrap}>
              <Ionicons name="information-circle" size={18} color="#FFD700" />
            </View>
            <Text style={styles.rulesTitle}>¿Cómo funciona la Polla Final?</Text>
            <Ionicons
              name={showRules ? 'chevron-up' : 'chevron-down'}
              size={18}
              color={theme.colors.textMuted}
            />
          </Pressable>

          {showRules && (
            <View style={styles.rulesBody}>
              <Text style={styles.rulesIntro}>
                Cuando queden los 8 equipos clasificados (Cuartos de Final), cada
                participante elige:
              </Text>

              <View style={styles.ruleLine}>
                <Text style={styles.ruleEmoji}>🥇</Text>
                <Text style={styles.ruleLabel}>Campeón Mundial</Text>
                <View style={styles.rulePtsBadge}><Text style={styles.rulePtsText}>12 pts</Text></View>
              </View>
              <View style={styles.ruleLine}>
                <Text style={styles.ruleEmoji}>🥈</Text>
                <Text style={styles.ruleLabel}>Subcampeón</Text>
                <View style={styles.rulePtsBadge}><Text style={styles.rulePtsText}>8 pts</Text></View>
              </View>
              <View style={styles.ruleLine}>
                <Text style={styles.ruleEmoji}>🥉</Text>
                <Text style={styles.ruleLabel}>Tercer Lugar</Text>
                <View style={styles.rulePtsBadge}><Text style={styles.rulePtsText}>4 pts</Text></View>
              </View>
              <View style={styles.ruleLine}>
                <Text style={styles.ruleEmoji}>🏅</Text>
                <Text style={styles.ruleLabel}>Cuarto Lugar</Text>
                <View style={styles.rulePtsBadge}><Text style={styles.rulePtsText}>2 pts</Text></View>
              </View>

              <View style={styles.ruleDivider} />

              <View style={styles.ruleNote}>
                <Ionicons name="trophy" size={14} color="#FFD700" />
                <Text style={styles.ruleNoteText}>
                  Quien sume <Text style={{ fontFamily: 'Poppins_700Bold' }}>más puntos</Text> gana
                  el <Text style={{ fontFamily: 'Poppins_700Bold' }}>POZO ACUMULADO</Text>. Si hay
                  empate, el pozo se reparte entre los ganadores.
                </Text>
              </View>

              <View style={styles.ruleNote}>
                <Ionicons name="time-outline" size={14} color={theme.colors.primaryLight} />
                <Text style={styles.ruleNoteText}>
                  Para cada partido <Text style={{ fontFamily: 'Poppins_700Bold' }}>solo cuenta el
                  tiempo reglamentario</Text> (90 min + adición).{' '}
                  <Text style={{ fontFamily: 'Poppins_700Bold' }}>NO</Text> cuentan los tiempos
                  extra (30 min) ni los penales.
                </Text>
              </View>
            </View>
          )}
        </Card>

        {loadingTournaments ? (
          [1, 2].map(i => <Skeleton key={i} width="100%" height={120} style={{ marginBottom: 12 }} />)
        ) : (tournaments?.length ?? 0) === 0 ? (
          <EmptyState icon="star-outline" title="Sin torneos" description="No hay torneos activos" />
        ) : (
          (tournaments ?? []).map((t: any, idx: number) => {
            const myBet  = betByTournament.get(t?.id);
            const hasBet = !!myBet;
            // Pozo gordo = jornadas × inscritos × bet_final
            const jornadasCount  = Number(t?._count?.matchdays    ?? t?.matchdays?.length ?? 0);
            // Solo cuentan los APROBADOS (no pendientes/rechazados) para el pozo
            const inscritosCount = Number(t?.approved_participants ?? t?._count?.participants ?? t?.participants?.length ?? 0);
            const betFinal       = Number(t?.bet_final ?? 0);
            const grandPrize     = jornadasCount * inscritosCount * betFinal;
            const cur            = t?.currency ?? 'Bs';
            // Deadline lock — tras la fecha límite NADIE puede apostar/cambiar.
            const deadline       = t?.final_bet_deadline ? new Date(t.final_bet_deadline) : null;
            const isPastDeadline = deadline ? new Date() > deadline : false;
            const deadlineLabel  = deadline
              ? `${String(deadline.getDate()).padStart(2,'0')}/${String(deadline.getMonth()+1).padStart(2,'0')}/${deadline.getFullYear()} ${String(deadline.getHours()).padStart(2,'0')}:${String(deadline.getMinutes()).padStart(2,'0')}`
              : null;

            // Escenario escalonado: 1° más alto, peana con numeral. Con apuesta
            // muestra banderas; vacío muestra "+" tocable; cerrado muestra candado.
            const podiumStage = (
              <View style={styles.podiumStage}>
                {PODIUM_POS.map((pos, i) => {
                  const h = [150, 120, 100, 86][i];
                  const first = i === 0;
                  const team = hasBet ? getTeam(myBet?.[pos.key]) : null;
                  return (
                    <View key={pos.key} style={styles.podiumCol}>
                      <View style={[
                        styles.podiumSlot,
                        !hasBet && styles.podiumSlotEmpty,
                        { height: h, borderColor: pos.color + (hasBet ? '80' : '66'), backgroundColor: pos.color + (hasBet ? '1A' : '12') },
                        first && styles.podiumSlotFirst,
                        first && { shadowColor: pos.color },
                      ]}>
                        <Text style={{ fontSize: first ? 28 : 21 }}>{pos.emoji}</Text>
                        {hasBet ? (
                          team ? (
                            <>
                              <TeamFlag team={team} size={first ? 32 : 26} />
                              <Text style={[styles.podiumTeamName, { color: pos.color, fontSize: first ? 12 : 11 }]} numberOfLines={1}>
                                {team?.name}
                              </Text>
                            </>
                          ) : (
                            <Text style={styles.podiumEmpty}>—</Text>
                          )
                        ) : isPastDeadline ? (
                          <Ionicons name="lock-closed" size={first ? 20 : 16} color={pos.color} />
                        ) : (
                          <View style={[
                            styles.pickAffordance,
                            { borderColor: pos.color + '99' },
                            first && { width: 30, height: 30, borderRadius: 15 },
                          ]}>
                            <Ionicons name="add" size={first ? 20 : 15} color={pos.color} />
                          </View>
                        )}
                        <Text style={styles.podiumPts}>{pos.pts}</Text>
                      </View>
                      <View style={[styles.plinth, { backgroundColor: pos.color + (hasBet ? '26' : '1F'), borderColor: pos.color + (hasBet ? '66' : '55') }]}>
                        <Text style={[styles.plinthNum, { color: pos.color }]}>{pos.short}</Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            );
            return (
              <Animated.View key={t?.id} entering={FadeInDown.delay(idx * 90).duration(360).springify()}>
              <Card style={styles.tournamentCard}>
                <View style={styles.tournamentHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.tournamentName}>{t?.name}</Text>
                    <Text style={styles.tournamentInfo}>
                      {cur} {betFinal} por jornada · {jornadasCount} jornadas · {inscritosCount} inscritos
                    </Text>
                  </View>
                  <Badge status={hasBet ? 'won' : 'pending'} text={hasBet ? 'Apostado' : 'Pendiente'} />
                </View>

                {/* ─── Premio Gordo callout — visible to everyone ──────────── */}
                <View style={[styles.pozoGordoBox, { shadowOpacity: 0.75, shadowRadius: 22, elevation: 16 }]}>
                  <LinearGradient
                    colors={['rgba(255,230,128,0.72)', 'rgba(255,215,0,0.64)', 'rgba(255,165,0,0.60)', 'rgba(212,160,23,0.66)']}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                    style={[styles.pozoGordoGradient, GLASS_WEB]}
                  >
                    <View style={styles.pozoGordoLabelRow}>
                      <Ionicons name="trophy" size={13} color="#7B5A00" />
                      <Text style={styles.pozoGordoLabel}>PREMIO GORDO</Text>
                    </View>
                    <Text style={styles.pozoGordoValue}>{formatMoney(grandPrize, cur)}</Text>
                    <Text style={styles.pozoGordoFormula}>
                      {jornadasCount} jornadas × {inscritosCount} inscritos × {formatMoney(betFinal, cur)}
                    </Text>
                  </LinearGradient>
                  {/* Shimmer dorado que barre el premio gordo */}
                  <Animated.View pointerEvents="none" style={[styles.pozoGordoShine, shineStyle]}>
                    <LinearGradient
                      colors={['transparent', 'rgba(255,255,255,0.65)', 'transparent']}
                      start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                      style={{ flex: 1 }}
                    />
                  </Animated.View>
                </View>
                <View style={styles.tieRow}>
                  <Ionicons name="information-circle-outline" size={11} color={theme.colors.textMuted} />
                  <Text style={styles.tieText}>
                    Si hay empate en la predicción del podio, el pozo se reparte entre los ganadores
                  </Text>
                </View>

                {/* Fecha límite — siempre visible si existe */}
                {deadlineLabel && (
                  <View style={styles.deadlineRow}>
                    <Ionicons
                      name={isPastDeadline ? 'lock-closed' : 'time-outline'}
                      size={12}
                      color={isPastDeadline ? '#EF4444' : theme.colors.textMuted}
                    />
                    <Text style={[styles.deadlineText, isPastDeadline && { color: '#EF4444' }]}>
                      {isPastDeadline ? 'Cerrada el ' : 'Cierra: '}{deadlineLabel}
                    </Text>
                  </View>
                )}

                {/* ─── PODIO — escenario sobre panel oscuro (héroe interactivo) ── */}
                {(!hasBet && !isPastDeadline) ? (
                  <Pressable onPress={() => openBetModal(t)}>
                    <LinearGradient colors={['#102643', '#0B1A30']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.stageWrap}>
                      {podiumStage}
                      <View style={styles.podiumHint}>
                        <Ionicons name="hand-left-outline" size={13} color="rgba(255,255,255,0.6)" />
                        <Text style={styles.podiumHintText}>Toca para armar tu podio</Text>
                      </View>
                    </LinearGradient>
                  </Pressable>
                ) : (
                  <LinearGradient colors={['#102643', '#0B1A30']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.stageWrap}>
                    {podiumStage}
                    {!hasBet && isPastDeadline && (
                      <View style={styles.podiumHint}>
                        <Ionicons name="lock-closed" size={13} color="#F87171" />
                        <Text style={[styles.podiumHintText, { color: '#F87171' }]}>Apuestas cerradas — pasó la fecha límite</Text>
                      </View>
                    )}
                  </LinearGradient>
                )}

                {/* ─── Acción / estado ──────────────────────────────────────── */}
                {hasBet ? (
                  <>
                    {myBet?.status === 'won' && (
                      <View style={styles.wonBadge}>
                        <Ionicons name="trophy" size={15} color="#10B981" />
                        <Text style={styles.wonText}>Ganaste {formatMoney(myBet?.prize_won ?? 0, cur)}</Text>
                      </View>
                    )}
                    {myBet?.status === 'lost' && (
                      <View style={[styles.wonBadge, { backgroundColor: 'rgba(239,68,68,0.15)' }]}>
                        <Text style={[styles.wonText, { color: '#EF4444' }]}>{myBet?.total_points ?? 0} puntos · no ganaste</Text>
                      </View>
                    )}
                  </>
                ) : isPastDeadline ? (
                  <View style={[styles.betButton, { backgroundColor: theme.colors.inputBg, borderWidth: 1, borderColor: theme.colors.border }]}>
                    <Ionicons name="lock-closed" size={18} color={theme.colors.textMuted} />
                    <Text style={[styles.betButtonText, { color: theme.colors.textMuted }]}>Apuestas cerradas</Text>
                  </View>
                ) : (
                  <Pressable style={styles.betButton} onPress={() => openBetModal(t)}>
                    <Ionicons name="star" size={20} color="#FFF" />
                    <Text style={styles.betButtonText}>Hacer mi Predicción</Text>
                  </Pressable>
                )}
              </Card>
              <QuarterTeamsBanner tournamentId={t?.id} />
              </Animated.View>
            );
          })
        )}
      </ScrollView>

      {showBetModal && selectedTournament && (
        <BetModal
          visible={showBetModal}
          tournament={selectedTournament}
          onClose={() => setShowBetModal(false)}
          onSuccess={() => {
            setShowBetModal(false);
            refetchBets();
          }}
        />
      )}
    </SafeAreaView>
  );
}

function BetModal({ visible, tournament, onClose, onSuccess }: { visible: boolean; tournament: any; onClose: () => void; onSuccess: () => void }) {
  const { theme } = useTheme();
  const modalStyles = useMemo(() => makeModalStyles(theme), [theme]);
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [picks, setPicks] = useState<{ pick_1st: string; pick_2nd: string; pick_3rd: string; pick_4th: string }>({
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

  const positions = [
    { key: 'pick_1st' as const, label: '1° Lugar', pts: '12 pts', emoji: '🥇', color: '#FFD700' },
    { key: 'pick_2nd' as const, label: '2° Lugar', pts: '8 pts', emoji: '🥈', color: '#C0C0C0' },
    { key: 'pick_3rd' as const, label: '3° Lugar', pts: '4 pts', emoji: '🥉', color: '#CD7F32' },
    { key: 'pick_4th' as const, label: '4° Lugar', pts: '2 pts', emoji: '4️⃣', color: '#94A3B8' },
  ];

  const selectedIds = [picks.pick_1st, picks.pick_2nd, picks.pick_3rd, picks.pick_4th].filter(Boolean);
  const allSelected = selectedIds.length === 4;

  const togglePick = (posKey: string, teamId: string) => {
    if (Platform.OS !== 'web') Haptics.impactAsync?.(Haptics.ImpactFeedbackStyle.Light);
    const current = picks[posKey as keyof typeof picks];
    setPicks({ ...picks, [posKey]: current === teamId ? '' : teamId });
  };

  const handleSubmit = async () => {
    if (!allSelected) {
      showToast('error', 'Selecciona los 4 equipos');
      return;
    }
    if (Platform.OS !== 'web') Haptics.notificationAsync?.(Haptics.NotificationFeedbackType.Success);
    setLoading(true);
    try {
      await api.post('/api/final-bets', {
        tournament_id: tournament?.id,
        ...picks,
      });
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
      <View style={modalStyles.header}>
        <Text style={modalStyles.title}>⭐ Polla Final</Text>
        <Text style={modalStyles.subtitle}>{tournament?.name}</Text>
        <Text style={modalStyles.hint}>Selecciona un equipo para cada posición</Text>
      </View>

      {loadingTeams ? (
        <Skeleton width="100%" height={200} />
      ) : (quarterTeams?.length ?? 0) < 4 ? (
        <View style={{ padding: 20, alignItems: 'center' }}>
          <Ionicons name="alert-circle" size={40} color={theme.colors.warning} />
          <Text style={{ color: theme.colors.textSecondary, marginTop: 8, textAlign: 'center' }}>
            Aún no hay suficientes equipos en cuartos de final ({quarterTeams?.length ?? 0}/8)
          </Text>
        </View>
      ) : (
        <>
          {positions.map((pos) => {
            const selectedTeam = (quarterTeams ?? []).find((t: any) => t?.id === picks[pos.key]);
            return (
              <View key={pos.key} style={modalStyles.positionBlock}>
                <View style={modalStyles.positionHeader}>
                  <Text style={modalStyles.positionEmoji}>{pos.emoji}</Text>
                  <Text style={modalStyles.positionLabel}>{pos.label}</Text>
                  <View style={[modalStyles.ptsBadge, { backgroundColor: `${pos.color}20` }]}>
                    <Text style={[modalStyles.ptsText, { color: pos.color }]}>{pos.pts}</Text>
                  </View>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    {(quarterTeams ?? []).map((team: any) => {
                      const isSelected = picks[pos.key] === team?.id;
                      const isUsed = selectedIds.includes(team?.id) && !isSelected;
                      return (
                        <Pressable
                          key={team?.id}
                          disabled={isUsed}
                          onPress={() => togglePick(pos.key, team?.id)}
                          style={[
                            modalStyles.teamChip,
                            isSelected && [modalStyles.teamChipSelected, { borderColor: pos.color }],
                            isUsed && modalStyles.teamChipDisabled,
                          ]}
                        >
                          <TeamFlag team={team} size={20} />
                          <Text style={[
                            modalStyles.teamChipText,
                            // El fondo del chip seleccionado es translucido (rosa claro),
                            // NO un gradient oscuro. Usamos textPrimary para mantener
                            // contraste sobre el fondo claro del tema "Día Claro".
                            isSelected && { color: theme.colors.textPrimary, fontFamily: 'Poppins_700Bold' },
                            isUsed && { color: theme.colors.textMuted },
                          ]}>
                            {team?.name}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </ScrollView>
                {selectedTeam && (
                  <View style={[modalStyles.selectedIndicator, { borderLeftColor: pos.color }]}>
                    <TeamFlag team={selectedTeam} size={18} />
                    <Text style={modalStyles.selectedText}>{selectedTeam?.name}</Text>
                  </View>
                )}
              </View>
            );
          })}

          {/* Summary */}
          {allSelected && (
            <View style={modalStyles.summary}>
              <Text style={modalStyles.summaryTitle}>Tu predicción:</Text>
              {positions.map(pos => {
                const team = (quarterTeams ?? []).find((t: any) => t?.id === picks[pos.key]);
                return (
                  <View key={pos.key} style={modalStyles.summaryRow}>
                    <Text style={{ fontSize: 16 }}>{pos.emoji}</Text>
                    <TeamFlag team={team} size={18} />
                    <Text style={modalStyles.summaryTeam}>{team?.name}</Text>
                  </View>
                );
              })}
            </View>
          )}

          <Button
            title={allSelected ? '🎯 Confirmar Predicción' : `Selecciona ${4 - selectedIds.length} equipo(s) más`}
            variant={allSelected ? 'accent' : 'outline'}
            size="lg"
            fullWidth
            onPress={handleSubmit}
            loading={loading}
            disabled={!allSelected}
            style={{ marginTop: 12 }}
          />
        </>
      )}
    </Modal>
  );
}

function makeModalStyles(t: typeof staticTheme) {
  return StyleSheet.create({
    header: { alignItems: 'center', marginBottom: 16 },
    title: { fontSize: 17, fontFamily: 'Poppins_700Bold', color: t.colors.textPrimary },
    subtitle: { fontSize: 14, fontFamily: 'Poppins_400Regular', color: t.colors.primaryLight, marginTop: 2 },
    hint: { fontSize: 12, fontFamily: 'Poppins_400Regular', color: t.colors.textMuted, marginTop: 4 },
    positionBlock: { marginBottom: 16 },
    positionHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    positionEmoji: { fontSize: 18 },
    positionLabel: { fontSize: 14, fontFamily: 'Poppins_600SemiBold', color: t.colors.textPrimary },
    ptsBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
    ptsText: { fontSize: 11, fontFamily: 'Poppins_700Bold' },
    teamChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 12,
      backgroundColor: t.colors.surfaceElevated,
      borderWidth: 1.5,
      borderColor: t.colors.border,
    },
    teamChipSelected: { backgroundColor: 'rgba(200,16,46,0.15)' },
    teamChipDisabled: { opacity: 0.25 },
    teamChipText: { color: t.colors.textPrimary, fontSize: 13, fontFamily: 'Poppins_500Medium' },
    selectedIndicator: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: 6,
      paddingLeft: 8,
      borderLeftWidth: 3,
    },
    selectedText: { color: t.colors.textPrimary, fontSize: 13, fontFamily: 'Poppins_600SemiBold' },
    summary: {
      backgroundColor: t.colors.surfaceElevated,
      borderRadius: 12,
      padding: 12,
      marginTop: 8,
      borderWidth: 1,
      borderColor: t.colors.border,
    },
    summaryTitle: { fontSize: 12, fontFamily: 'Poppins_700Bold', color: t.colors.primaryLight, marginBottom: 8 },
    summaryRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 3 },
    summaryTeam: { color: t.colors.textPrimary, fontSize: 14, fontFamily: 'Poppins_600SemiBold' },
  });
}

function makeStyles(t: typeof staticTheme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: t.colors.bg },
    headerGradient: {
      paddingHorizontal: 24,
      paddingTop: 18,
      paddingBottom: 28,
    },
    headerTitle: {
      fontSize: 22,
      fontFamily: 'Poppins_800ExtraBold',
      color: '#fff',
      letterSpacing: -0.4,
    },
    headerSubtitle: {
      fontSize: 12,
      fontFamily: 'Poppins_400Regular',
      color: 'rgba(255,255,255,0.6)',
      marginTop: 2,
    },
    // En escritorio el contenido se centra y no se estira a lo ancho; en móvil
    // ocupa todo (la pantalla siempre es < maxWidth).
    content: { padding: 20, paddingBottom: 80, width: '100%', maxWidth: 920, alignSelf: 'center' },
    tournamentCard: { marginBottom: 14 },
    tournamentHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },

    // ── Premio Gordo callout ────────────────────────────────────────────────
    pozoGordoBox: {
      marginVertical: 10,
      borderRadius: 14,
      overflow: 'hidden',
      shadowColor: '#FFD700',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.4,
      shadowRadius: 12,
      elevation: 8,
    },
    pozoGordoGradient: {
      paddingVertical: 14,
      paddingHorizontal: 14,
      alignItems: 'center',
      borderRadius: 14,
      borderWidth: 1.5,
      borderColor: 'rgba(255,255,255,0.3)',
    },
    pozoGordoLabelRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
    },
    pozoGordoLabel: {
      fontSize: 11,
      fontFamily: 'Poppins_800ExtraBold',
      color: '#7B5A00',
      letterSpacing: 1.4,
    },
    pozoGordoValue: {
      fontSize: 40,
      fontFamily: 'Poppins_800ExtraBold',
      color: '#3D2A00',
      letterSpacing: -1.2,
      marginTop: 2,
      textShadowColor: 'rgba(255,255,255,0.5)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 1,
    },
    pozoGordoShine: {
      position: 'absolute',
      top: -12, bottom: -12,
      left: 0,
      width: 70,
    },
    pozoGordoFormula: {
      fontSize: 10,
      fontFamily: 'Poppins_600SemiBold',
      color: '#5B3F00',
      marginTop: 3,
    },
    tieRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      justifyContent: 'center',
      marginBottom: 10,
      paddingHorizontal: 4,
    },
    tieText: {
      fontSize: 10,
      fontFamily: 'Poppins_500Medium',
      color: t.colors.textMuted,
      fontStyle: 'italic' as const,
      flex: 1,
    },
    tournamentName: { fontSize: 14, fontFamily: 'Poppins_700Bold', color: t.colors.textPrimary },
    tournamentInfo: { fontSize: 12, fontFamily: 'Poppins_400Regular', color: t.colors.textSecondary, marginTop: 2 },
    deadlineRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 8, marginBottom: 2 },
    deadlineText: { fontSize: 11, fontFamily: 'Poppins_600SemiBold', color: t.colors.textMuted },

    // ─── Reglas ───────────────────────────────────────────────────────
    rulesHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14 },
    rulesIconWrap: {
      width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center',
      backgroundColor: 'rgba(255,215,0,0.14)',
    },
    rulesTitle: { flex: 1, fontSize: 13, fontFamily: 'Poppins_700Bold', color: t.colors.textPrimary },
    rulesBody: { paddingHorizontal: 14, paddingBottom: 14, gap: 8 },
    rulesIntro: { fontSize: 12, fontFamily: 'Poppins_400Regular', color: t.colors.textSecondary, lineHeight: 17, marginBottom: 2 },
    ruleLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    ruleEmoji: { fontSize: 16, width: 22, textAlign: 'center' as const },
    ruleLabel: { flex: 1, fontSize: 13, fontFamily: 'Poppins_600SemiBold', color: t.colors.textPrimary },
    rulePtsBadge: {
      backgroundColor: 'rgba(37,99,235,0.12)', borderRadius: 8, paddingHorizontal: 9, paddingVertical: 3,
    },
    rulePtsText: { fontSize: 11, fontFamily: 'Poppins_700Bold', color: t.colors.primaryLight },
    ruleDivider: { height: StyleSheet.hairlineWidth, backgroundColor: t.colors.border, marginVertical: 6 },
    ruleNote: { flexDirection: 'row', alignItems: 'flex-start', gap: 7 },
    ruleNoteText: { flex: 1, fontSize: 11.5, fontFamily: 'Poppins_400Regular', color: t.colors.textSecondary, lineHeight: 16 },
    betSummary: { backgroundColor: t.colors.surfaceElevated, borderRadius: 12, padding: 8 },
    betLabel: { fontSize: 12, fontFamily: 'Poppins_700Bold', color: t.colors.primaryLight, marginBottom: 6 },
    pickRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 5 },
    pickLabel: { color: t.colors.textSecondary, fontSize: 13, width: 50 },
    pickTeam: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
    pickName: { color: t.colors.textPrimary, fontSize: 14, fontFamily: 'Poppins_600SemiBold' },
    pickPts: { color: t.colors.textMuted, fontSize: 11 },
    wonBadge: {
      flexDirection: 'row',
      backgroundColor: 'rgba(16,185,129,0.15)',
      borderRadius: 8,
      paddingVertical: 8,
      paddingHorizontal: 10,
      marginTop: 10,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
    },
    wonText: { color: '#10B981', fontFamily: 'Poppins_700Bold', fontSize: 14 },

    // ── Podio: escenario escalonado sobre panel oscuro ──────────────────────
    stageWrap: {
      borderRadius: 16,
      padding: 14,
      marginTop: 4,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.08)',
      overflow: 'hidden',
    },
    podiumStage: { flexDirection: 'row', gap: 8, alignItems: 'flex-end' },
    podiumCol: { flex: 1, gap: 4 },
    podiumSlot: {
      width: '100%', alignItems: 'center', justifyContent: 'center', gap: 4,
      borderRadius: 12, borderWidth: 1, paddingVertical: 10, paddingHorizontal: 4,
    },
    podiumSlotFirst: {
      borderWidth: 1.5,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.6, shadowRadius: 14, elevation: 10,
    },
    podiumSlotEmpty: { borderStyle: 'dashed' as 'dashed' },
    podiumTeamName: { fontSize: 11, fontFamily: 'Poppins_700Bold', textAlign: 'center' },
    podiumEmpty: { fontSize: 20, color: 'rgba(255,255,255,0.25)' },
    podiumPts: { fontSize: 10, fontFamily: 'Poppins_700Bold', color: 'rgba(255,255,255,0.6)' },
    pickAffordance: {
      width: 24, height: 24, borderRadius: 12, borderWidth: 1.5,
      borderStyle: 'dashed' as 'dashed',
      alignItems: 'center', justifyContent: 'center', marginVertical: 2,
    },
    plinth: {
      width: '100%', height: 34, borderRadius: 10, borderWidth: 1,
      alignItems: 'center', justifyContent: 'center',
    },
    plinthNum: { fontSize: 18, fontFamily: 'Poppins_800ExtraBold' },
    podiumHint: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      gap: 6, marginTop: 12,
    },
    podiumHintText: { fontFamily: 'Poppins_600SemiBold', fontSize: 12, color: 'rgba(255,255,255,0.6)' },
    betButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: t.colors.accent,
      borderRadius: 12,
      paddingVertical: 14,
      gap: 8,
      marginTop: 8,
    },
    betButtonText: { color: '#FFF', fontFamily: 'Poppins_700Bold', fontSize: 15 },
  });
}