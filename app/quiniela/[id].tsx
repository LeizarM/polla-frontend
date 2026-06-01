import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, router } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { safeGoBack } from '../../utils/navigation';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Skeleton } from '../../components/ui/Skeleton';
import { TeamFlag } from '../../components/ui/TeamFlag';
import { useToast } from '../../components/ui/Toast';
import { useAuthStore } from '../../store/authStore';
import { useTheme } from '../../contexts/ThemeContext';
import { theme as staticTheme } from '../../constants/theme';
import { getRandomBetMessage } from '../../constants/betMessages';
import api from '../../services/api';

type PickValue = 'L' | 'E' | 'V' | null;

interface MatchItem {
  id: string;
  match_date: string;
  status: string;
  score_a?: number | null;
  score_b?: number | null;
  result?: string | null;
  team_a: { id: string; name: string; country: string; shield_url?: string };
  team_b: { id: string; name: string; country: string; shield_url?: string };
}

function formatCurrency(amount: number, currency = 'Bs'): string {
  return `${currency} ${Number(amount ?? 0).toFixed(2)}`;
}

function formatMatchDate(dateStr: string): string {
  try {
    const d   = new Date(dateStr);
    const day = String(d.getDate()).padStart(2, '0');
    const mo  = String(d.getMonth() + 1).padStart(2, '0');
    const hh  = String(d.getHours()).padStart(2, '0');
    const mm  = String(d.getMinutes()).padStart(2, '0');
    return `${day}/${mo}/${d.getFullYear()}  ${hh}:${mm}`;
  } catch {
    return dateStr ?? '';
  }
}

export default function MatchdayDetailScreen() {
  const { id = '' } = useLocalSearchParams<{ id: string }>();
  const { user, refreshUser } = useAuthStore();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  // picks: keyed by match_id
  const [picks, setPicks] = useState<Record<string, PickValue>>({});
  const [showConfirm, setShowConfirm] = useState(false);
  const [picksInitialized, setPicksInitialized] = useState(false);

  // ── matchday ────────────────────────────────────────────────────────────────
  const { data: matchday, isLoading } = useQuery({
    queryKey: ['matchday-detail', id],
    queryFn: async () => {
      if (!id) return null;
      const res = await api.get(`/api/matchdays/${id}`);
      return res?.data ?? null;
    },
    enabled: !!id,
  });

  // ── my ticket for this matchday ─────────────────────────────────────────────
  const { data: myTickets } = useQuery({
    queryKey: ['my-tickets-matchday', id],
    queryFn: async () => {
      if (!id) return [];
      const res = await api.get(`/api/tickets/me?matchday_id=${id}`);
      return res?.data ?? [];
    },
    enabled: !!id,
  });

  // Auto-refresh when the screen comes into focus (so scores entered elsewhere
  // are visible immediately on navigation back to this screen).
  useFocusEffect(useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['matchday-detail', id] });
    queryClient.invalidateQueries({ queryKey: ['my-tickets-matchday', id] });
    queryClient.invalidateQueries({ queryKey: ['ticket-detail'] });
  }, [id, queryClient]));

  const matches: MatchItem[] = matchday?.matches ?? [];
  const tournament = matchday?.tournament;
  // Treat matchday as "open" UNLESS explicitly closed/finished/resolved. This is
  // forgiving for status variations like 'active' or undefined while still locking
  // ended matchdays. Per-match locking still applies below.
  const isOpen = !!matchday && (
    matchday.status !== 'resolved' &&
    matchday.status !== 'finished' &&
    matchday.status !== 'closed'
  );
  const betPerMatchday = Number(tournament?.bet_per_matchday ?? 10);
  // Pozo REAL: solo lo efectivamente apostado. Crece Bs {bet} por cada apuesta
  // registrada. Empieza en 0 hasta que alguien apuesta. (Igual que la lista Apostar.)
  const currentPool = Number(matchday?.total_pool ?? 0);
  // Nº de apuestas que ya formaron el pozo (pozo / monto fijo por jornada)
  const betsCount = betPerMatchday > 0 ? Math.round(currentPool / betPerMatchday) : 0;
  const currency = tournament?.currency ?? 'Bs';

  // The user's real ticket (amount_bet > 0)
  const existingTicket = (myTickets ?? []).find((t: any) => Number(t.amount_bet) > 0) ?? null;
  const existingTicketId: string | null = existingTicket?.id ?? null;

  // ── Fetch full ticket detail to get picks ───────────────────────────────────
  const { data: ticketDetail } = useQuery({
    queryKey: ['ticket-detail', existingTicketId],
    queryFn: async () => {
      if (!existingTicketId) return null;
      const res = await api.get(`/api/tickets/${existingTicketId}`);
      return res?.data ?? null;
    },
    enabled: !!existingTicketId,
  });

  // ── Pre-populate picks from existing ticket ─────────────────────────────────
  useEffect(() => {
    if (picksInitialized) return;
    if (!ticketDetail?.ticket_picks) return;
    const pre: Record<string, PickValue> = {};
    for (const p of ticketDetail.ticket_picks) {
      pre[p.match_id] = p.pick as PickValue;
    }
    setPicks(pre);
    setPicksInitialized(true);
  }, [ticketDetail, picksInitialized]);

  // ── Per-match lock status (no longer all-or-nothing) ────────────────────────
  const now = new Date();
  // First match that has already started — used in messaging
  const startedMatch = (() => {
    const started = matches
      .map((m) => ({ m, t: new Date(m.match_date).getTime() }))
      .filter(({ t }) => !isNaN(t) && t <= now.getTime())
      .sort((a, b) => a.t - b.t);
    return started.length ? started[0].m : null;
  })();
  const anyMatchStarted     = !!startedMatch;
  // At least one match still ahead → user can still interact with the picks UI
  const someMatchNotStarted = matches.some((m) => {
    const t = new Date(m.match_date).getTime();
    return isNaN(t) || t > now.getTime();
  });

  // Edit mode: user has a ticket and matchday is open and at least one match
  // hasn't started yet. Individual started matches are still locked below.
  const isEditMode   = !!existingTicketId && isOpen && someMatchNotStarted;
  // New bet mode: no ticket yet and matchday is open and at least one match still ahead.
  const isNewBetMode = !existingTicketId && isOpen && someMatchNotStarted;
  // Top-level "can the user interact at all"
  const canEdit      = isEditMode || isNewBetMode;

  // At least 1 pick required to submit
  const canSubmit = Object.keys(picks).length > 0;

  // ── Pick handler — also enforces per-match lock at the source ───────────────
  const handlePick = useCallback(
    (matchId: string, pick: PickValue) => {
      if (!canEdit) return;
      // Reject picks for matches that already started (defense in depth — buttons
      // are also disabled, but this prevents API misuse).
      const match = matches.find((m) => m.id === matchId);
      if (match) {
        const t = new Date(match.match_date).getTime();
        if (!isNaN(t) && t <= now.getTime()) {
          showToast('error', 'Este partido ya inició, no puedes cambiar tu predicción');
          return;
        }
      }
      setPicks((prev) => {
        // Deselect if same pick tapped again
        if (prev[matchId] === pick) {
          const next = { ...prev };
          delete next[matchId];
          return next;
        }
        return { ...prev, [matchId]: pick };
      });
      if (Platform.OS !== 'web') {
        Haptics.impactAsync?.(Haptics.ImpactFeedbackStyle.Light);
      }
      // Pass team names so the troll message references the actual matchup
      if (match && pick) {
        showToast(
          'info',
          getRandomBetMessage(pick, match.team_a?.name, match.team_b?.name),
        );
      }
    },
    [canEdit, matches, showToast, now],
  );

  // ── Submit: POST (new) or PATCH (edit) ───────────────────────────────────────
  const submitMutation = useMutation({
    mutationFn: async () => {
      // Filter out picks for matches that already started — backend should reject these
      // but we strip them here too so the request is clean.
      const startedIds = new Set(
        matches
          .filter((m) => {
            const t = new Date(m.match_date).getTime();
            return !isNaN(t) && t <= now.getTime();
          })
          .map((m) => m.id),
      );
      const picksArray = Object.entries(picks)
        .filter(([match_id, v]) => v !== null && !startedIds.has(match_id))
        .map(([match_id, pick]) => ({ match_id, pick }));

      if (isEditMode && existingTicketId) {
        const res = await api.patch(`/api/tickets/${existingTicketId}/picks`, {
          picks: picksArray,
        });
        return { ticket: res?.data, isEdit: true };
      } else {
        const res = await api.post('/api/tickets', {
          matchday_id: id,
          picks: picksArray,
        });
        return { ticket: res?.data, isEdit: false };
      }
    },
    onSuccess: ({ ticket, isEdit }: any) => {
      if (isEdit) {
        showToast('success', '¡Predicción actualizada! 🔄');
      } else {
        showToast('success', '¡Boleto creado! Buena suerte 🍀');
      }
      queryClient.invalidateQueries({ queryKey: ['my-tickets-matchday', id] });
      queryClient.invalidateQueries({ queryKey: ['ticket-detail', existingTicketId] });
      queryClient.invalidateQueries({ queryKey: ['matchday-detail', id] });
      queryClient.invalidateQueries({ queryKey: ['my-tickets-all'] });
      queryClient.invalidateQueries({ queryKey: ['user-matchdays'] });
      if (!isEdit) refreshUser();
      setShowConfirm(false);
      if (ticket?.id) {
        router.push(`/quiniela/ticket/${ticket.id}` as any);
      }
    },
    onError: (error: any) => {
      const rawMsg =
        error?.response?.data?.message || error?.friendlyMessage || 'Error al guardar predicción';
      const msg = typeof rawMsg === 'string' ? rawMsg : 'Error al guardar predicción';
      showToast('error', msg);
      setShowConfirm(false);
    },
  });

  // ── Pick button renderer ──────────────────────────────────────────────────────
  const renderPickButton = (
    matchId: string,
    value: PickValue,
    label: string,
    color: string,
    locked: boolean,
  ) => {
    const selected = picks[matchId] === value;
    const disabled = locked || !canEdit;
    const onPress = () => {
      if (disabled) return;
      // Haptic medio cuando seleccionas pick — confirma la decisión
      if (Platform.OS !== 'web') {
        import('expo-haptics')
          .then(H => H.impactAsync(H.ImpactFeedbackStyle.Medium))
          .catch(() => {});
      }
      handlePick(matchId, value);
    };
    return (
      <Pressable
        style={[
          styles.pickButton,
          selected && { backgroundColor: color, borderColor: color },
          disabled && !selected && styles.pickButtonDisabled,
          // opacity 0.45 cuando está bloqueado (per handoff)
          locked && !selected && { opacity: 0.45 },
        ]}
        onPress={onPress}
        disabled={disabled}
      >
        <Text
          style={[
            styles.pickButtonText,
            selected && { color: '#fff', fontWeight: theme.fontWeight.bold },
            disabled && !selected && { color: theme.colors.textMuted },
          ]}
          numberOfLines={2}
          adjustsFontSizeToFit
        >
          {label}
        </Text>
      </Pressable>
    );
  };

  // ── Loading ───────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Skeleton width={'80%' as any} height={28} />
          <Skeleton width={'60%' as any} height={18} style={{ marginTop: 8 }} />
          {[1, 2, 3].map((i) => (
            <Card key={i} style={{ marginTop: 16, padding: 16 }}>
              <Skeleton width={'100%' as any} height={60} />
            </Card>
          ))}
        </View>
      </SafeAreaView>
    );
  }

  const submitButtonLabel = isEditMode
    ? 'Actualizar Predicción'
    : `Enviar Predicción (${currency} ${betPerMatchday})`;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Header */}
        <Animated.View entering={FadeIn.duration(400)}>
          <LinearGradient colors={[theme.colors.primary, theme.colors.primaryLight]} start={{ x: 0, y: 0 }} end={{ x: 0.7, y: 1 }} style={styles.header}>
            <Pressable
              onPress={() => safeGoBack('/user')}
              style={styles.backButton}
            >
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </Pressable>
            <View style={styles.headerInfo}>
              <Text style={styles.headerTitle} numberOfLines={1}>
                {matchday?.name ?? 'Jornada'}
              </Text>
              <Text style={styles.headerSubtitle} numberOfLines={1}>
                {tournament?.name ?? 'Torneo'}
              </Text>
            </View>
            <Badge status={(matchday?.status as any) ?? 'pending'} />
          </LinearGradient>
        </Animated.View>

        {/* Pool Info Bar */}
        <View style={styles.poolBar}>
          <View style={styles.poolItem}>
            <Ionicons name="cash-outline" size={16} color={theme.colors.success} />
            <Text style={styles.poolLabel}>Pozo actual</Text>
            <Text style={styles.poolValue}>{formatCurrency(currentPool, currency)}</Text>
          </View>
          <View style={styles.poolDivider} />
          <View style={styles.poolItem}>
            <Ionicons name="people-outline" size={16} color={theme.colors.gold} />
            <Text style={styles.poolLabel}>Apuestas</Text>
            <Text style={styles.poolValue}>{betsCount}</Text>
          </View>
          <View style={styles.poolDivider} />
          <View style={styles.poolItem}>
            <Ionicons name="football-outline" size={16} color={theme.colors.primaryLight} />
            <Text style={styles.poolLabel}>Partidos</Text>
            <Text style={styles.poolValue}>{matches?.length ?? 0}</Text>
          </View>
        </View>

        {/* Pool formula hint — clarifies how the pot grows */}
        <View style={styles.poolHint}>
          <Ionicons name="information-circle-outline" size={13} color={theme.colors.textMuted} />
          <Text style={styles.poolHintText}>
            El pozo es dinero REAL apostado: suma {formatCurrency(betPerMatchday, currency)} por
            cada apuesta registrada. Empieza en {formatCurrency(0, currency)} y crece cuando los
            inscritos hacen su apuesta.
          </Text>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Quick nav cards */}
          <View style={styles.quickNavRow}>
            <Pressable
              style={({ pressed }) => [styles.quickNavCard, styles.quickNavCardBets, { opacity: pressed ? 0.82 : 1 }]}
              onPress={() => router.push(`/quiniela/bet-log/${id}` as any)}
            >
              <View style={styles.quickNavIconWrap}>
                <Ionicons name="eye-outline" size={28} color="#fff" />
              </View>
              <Text style={styles.quickNavTitle}>Ver Apuestas</Text>
              <Text style={styles.quickNavSub}>En vivo · jornada</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.quickNavCard, styles.quickNavCardRanking, { opacity: pressed ? 0.82 : 1 }]}
              onPress={() => router.push(`/quiniela/ranking/${id}` as any)}
            >
              <View style={styles.quickNavIconWrap}>
                <Ionicons name="podium-outline" size={28} color="#fff" />
              </View>
              <Text style={styles.quickNavTitle}>Ver Ranking</Text>
              <Text style={styles.quickNavSub}>Clasificación</Text>
            </Pressable>
          </View>

          {/* Matches section */}
          {(canEdit || existingTicket) && (
            <>
              <Text style={styles.sectionTitle}>
                {isEditMode
                  ? 'Modifica tus Selecciones'
                  : isNewBetMode
                  ? 'Elige tus Resultados'
                  : 'Tus Selecciones'}
              </Text>

              {isEditMode && (
                <View style={styles.editBanner}>
                  <Ionicons name="pencil" size={14} color={theme.colors.warning} />
                  <Text style={styles.editBannerText}>
                    Modo edición — puedes cambiar tus picks antes de que inicien los partidos.
                    Toca una selección activa para deseleccionarla.
                  </Text>
                </View>
              )}

              {isNewBetMode && (
                <Text style={styles.sectionHint}>
                  Selecciona al menos un partido. Los que no selecciones quedan sin predicción.
                </Text>
              )}

              {/* Regla de tiempo reglamentario — aplica a TODOS los partidos */}
              <View style={styles.regTimeNote}>
                <Ionicons name="time-outline" size={13} color={theme.colors.textMuted} />
                <Text style={styles.regTimeText}>
                  Solo cuenta el tiempo reglamentario (90 min + adición). No cuentan
                  tiempos extra ni penales.
                </Text>
              </View>

              {anyMatchStarted && (
                <View style={[styles.editBanner, { borderColor: 'rgba(245,158,11,0.35)', backgroundColor: 'rgba(245,158,11,0.10)' }]}>
                  <Ionicons name="information-circle" size={14} color={theme.colors.warning} />
                  <Text style={[styles.editBannerText, { color: theme.colors.warning }]}>
                    Algunos partidos ya iniciaron y están bloqueados. Aún puedes cambiar tus
                    predicciones para los partidos que no han comenzado.
                  </Text>
                </View>
              )}

              {matches.map((match: MatchItem, index: number) => {
                const matchStarted = new Date(match.match_date) <= now;
                const myPick = picks[match.id] ?? null;
                const locked = matchStarted;

                return (
                  <Animated.View
                    key={match?.id}
                    entering={FadeInDown.delay(index * 60).duration(350)}
                  >
                    <View style={[
                      styles.matchCard,
                      { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
                      locked && styles.matchCardLocked,
                    ]}>
                      <LinearGradient
                        colors={locked
                          ? ['#EF444440', '#EF444420', 'transparent']
                          : [theme.colors.primary, theme.colors.primaryLight, 'transparent']}
                        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                        style={{ height: 1.5 }}
                      />
                      <View style={styles.matchCardBody}>
                      <View style={styles.matchDateRow}>
                        <Text style={styles.matchDate}>
                          {formatMatchDate(match?.match_date)}
                        </Text>
                        {locked && (
                          <View style={styles.lockedBadge}>
                            <Ionicons name="lock-closed" size={11} color="#EF4444" />
                            <Text style={styles.lockedBadgeText}>Iniciado</Text>
                          </View>
                        )}
                        {!locked && match.status === 'open' && myPick && (
                          <View style={styles.pickedBadge}>
                            <Ionicons name="checkmark-circle" size={11} color={theme.colors.success} />
                            <Text style={styles.pickedBadgeText}>Seleccionado</Text>
                          </View>
                        )}
                      </View>

                      <View style={styles.matchTeams}>
                        <View style={styles.teamColumn}>
                          <TeamFlag team={match?.team_a} size={36} />
                          <Text style={styles.teamName} numberOfLines={2}>
                            {match?.team_a?.name ?? 'Local'}
                          </Text>
                        </View>
                        <View style={styles.vsBlock}>
                          <Text style={styles.vsText}>VS</Text>
                          {(match.score_a != null && match.score_b != null) && (
                            <Text style={styles.scoreText}>
                              {match.score_a} - {match.score_b}
                            </Text>
                          )}
                        </View>
                        <View style={styles.teamColumn}>
                          <TeamFlag team={match?.team_b} size={36} />
                          <Text style={styles.teamName} numberOfLines={2}>
                            {match?.team_b?.name ?? 'Visitante'}
                          </Text>
                        </View>
                      </View>

                      {/* Pick Buttons */}
                      <View style={styles.pickRow}>
                        {renderPickButton(
                          match.id,
                          'L',
                          `Gana ${match.team_a?.name ?? 'Local'}`,
                          '#0052CC',
                          locked,
                        )}
                        {renderPickButton(match.id, 'E', 'Empate', '#F59E0B', locked)}
                        {renderPickButton(
                          match.id,
                          'V',
                          `Gana ${match.team_b?.name ?? 'Visitante'}`,
                          '#C8102E',
                          locked,
                        )}
                      </View>

                      {/* Result indicator if resolved */}
                      {match.result && (
                        <View style={styles.resultRow}>
                          <Text style={styles.resultLabel}>Resultado oficial:</Text>
                          <Text style={styles.resultValue}>
                            {match.result === 'L'
                              ? `Ganó ${match.team_a?.name}`
                              : match.result === 'V'
                              ? `Ganó ${match.team_b?.name}`
                              : 'Empate'}
                          </Text>
                          {myPick && (
                            <Ionicons
                              name={myPick === match.result ? 'checkmark-circle' : 'close-circle'}
                              size={18}
                              color={myPick === match.result ? theme.colors.success : '#EF4444'}
                            />
                          )}
                        </View>
                      )}
                      </View>
                    </View>
                  </Animated.View>
                );
              })}

              {/* Submit section */}
              {canEdit && (
                <View style={styles.submitSection}>
                  {isNewBetMode && (
                    <View style={styles.betSection}>
                      <Text style={styles.betLabel}>Apuesta por jornada</Text>
                      <Text style={styles.betHint}>
                        Monto fijo: {formatCurrency(betPerMatchday, currency)} por participante
                      </Text>
                    </View>
                  )}

                  <Button
                    title={submitButtonLabel}
                    variant="accent"
                    fullWidth
                    size="lg"
                    icon={isEditMode ? 'pencil' : 'ticket'}
                    disabled={!canSubmit}
                    loading={false}
                    onPress={() => setShowConfirm(true)}
                  />

                  {!canSubmit && (
                    <Text style={styles.noPicksHint}>
                      Selecciona al menos un partido para continuar
                    </Text>
                  )}
                </View>
              )}
            </>
          )}

          {/* ── Empty / blocked states — make it CLEAR why no bet UI ───────── */}
          {!canEdit && !existingTicket && (
            <View style={styles.statusBox}>
              {!isOpen ? (
                <>
                  <Ionicons name="time-outline" size={32} color={theme.colors.warning} />
                  <Text style={styles.statusBoxTitle}>Jornada aún no abierta</Text>
                  <Text style={styles.statusBoxText}>
                    El administrador debe abrir esta jornada antes de aceptar apuestas.
                    El estado actual es: {matchday?.status ?? '—'}.
                  </Text>
                </>
              ) : matches.length === 0 ? (
                <>
                  <Ionicons name="football-outline" size={32} color={theme.colors.textMuted} />
                  <Text style={styles.statusBoxTitle}>Sin partidos</Text>
                  <Text style={styles.statusBoxText}>
                    Esta jornada todavía no tiene partidos cargados. Vuelve más tarde.
                  </Text>
                </>
              ) : anyMatchStarted ? (
                <>
                  <Ionicons name="lock-closed" size={32} color="#EF4444" />
                  <Text style={styles.statusBoxTitle}>Apuestas cerradas</Text>
                  <Text style={styles.statusBoxText}>
                    Todos los partidos de esta jornada ya iniciaron. No es posible registrar
                    una nueva apuesta.
                  </Text>
                  {startedMatch && (
                    <View style={styles.startedMatchBox}>
                      <Text style={styles.startedMatchLabel}>Primer partido iniciado:</Text>
                      <Text style={styles.startedMatchName}>
                        {startedMatch.team_a?.name} vs {startedMatch.team_b?.name}
                      </Text>
                      <Text style={styles.startedMatchTime}>
                        {formatMatchDate(startedMatch.match_date)}
                      </Text>
                      <Text style={styles.startedMatchNow}>
                        Hora actual: {formatMatchDate(now.toISOString())}
                      </Text>
                      {(() => {
                        // If the started match is more than 6h in the past, the date is
                        // probably stale (created before timezone fix). Suggest re-saving.
                        const hoursAgo = (now.getTime() - new Date(startedMatch.match_date).getTime()) / 3600000;
                        if (hoursAgo > 6) {
                          return (
                            <Text style={styles.startedMatchHint}>
                              ⓘ Si la fecha del partido no es correcta, el admin debe editar la jornada
                              y volver a guardar para sincronizar las fechas de los partidos.
                            </Text>
                          );
                        }
                        return null;
                      })()}
                    </View>
                  )}
                </>
              ) : (
                <>
                  <Ionicons name="information-circle-outline" size={32} color={theme.colors.textMuted} />
                  <Text style={styles.statusBoxTitle}>No disponible</Text>
                  <Text style={styles.statusBoxText}>
                    No puedes apostar en esta jornada en este momento.
                  </Text>
                </>
              )}
            </View>
          )}

        </ScrollView>
      </KeyboardAvoidingView>

      {/* ── Confirmation Modal ──────────────────────────────────────────── */}
      <Modal
        visible={showConfirm}
        transparent
        animationType="fade"
        onRequestClose={() => !submitMutation.isPending && setShowConfirm(false)}
      >
        <View style={styles.modalOverlay}>
          <Animated.View entering={FadeInDown.duration(280)} style={styles.modalCard}>

            {/* Icon */}
            <View style={styles.modalIconWrap}>
              <Ionicons
                name={isEditMode ? 'pencil-outline' : 'ticket-outline'}
                size={34}
                color={theme.colors.primary}
              />
            </View>

            {/* Title */}
            <Text style={styles.modalTitle}>
              {isEditMode ? 'Confirmar cambios' : 'Confirmar predicción'}
            </Text>
            <Text style={styles.modalSubtitle}>
              {isEditMode
                ? 'Revisa tus selecciones antes de actualizar'
                : `Recuerda que son ${formatCurrency(betPerMatchday, currency)} por jornada`}
            </Text>

            {/* Picks summary */}
            <View style={styles.modalPicksList}>
              {matches.filter((m) => picks[m.id]).map((m) => (
                <View key={m.id} style={styles.modalPickRow}>
                  <Text style={styles.modalPickMatch} numberOfLines={1}>
                    {m.team_a.name} vs {m.team_b.name}
                  </Text>
                  <View
                    style={[
                      styles.modalPickBadge,
                      {
                        backgroundColor:
                          picks[m.id] === 'L'
                            ? '#0052CC'
                            : picks[m.id] === 'V'
                            ? '#C8102E'
                            : '#F59E0B',
                      },
                    ]}
                  >
                    <Text style={styles.modalPickBadgeText}>
                      {picks[m.id] === 'L'
                        ? `Gana ${m.team_a.name}`
                        : picks[m.id] === 'V'
                        ? `Gana ${m.team_b.name}`
                        : 'Empate'}
                    </Text>
                  </View>
                </View>
              ))}

              {matches.filter((m) => !picks[m.id]).length > 0 && (
                <View style={styles.modalNoPickRow}>
                  <Ionicons name="remove-circle-outline" size={13} color={theme.colors.textMuted} />
                  <Text style={styles.modalNoPickText}>
                    {matches.filter((m) => !picks[m.id]).length} partido(s) sin predicción
                  </Text>
                </View>
              )}
            </View>

            {/* Action buttons */}
            <View style={styles.modalButtons}>
              <Pressable
                style={styles.modalCancelBtn}
                onPress={() => setShowConfirm(false)}
                disabled={submitMutation.isPending}
              >
                <Text style={styles.modalCancelText}>Cancelar</Text>
              </Pressable>

              <Pressable
                style={[styles.modalConfirmBtn, submitMutation.isPending && { opacity: 0.7 }]}
                onPress={() => submitMutation.mutate()}
                disabled={submitMutation.isPending}
              >
                {submitMutation.isPending ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.modalConfirmText}>
                    {isEditMode ? 'Actualizar' : 'Confirmar'}
                  </Text>
                )}
              </Pressable>
            </View>

          </Animated.View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function makeStyles(t: typeof staticTheme) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: t.colors.bg,
    },
    loadingContainer: {
      padding: 20,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 14,
      paddingBottom: 22,
    },
    backButton: {
      width: 40, height: 40, borderRadius: 12,
      backgroundColor: 'rgba(255,255,255,0.10)',
      borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
      alignItems: 'center', justifyContent: 'center',
    },
    headerInfo: {
      flex: 1,
      marginLeft: 10,
      marginRight: 10,
    },
    headerTitle: {
      fontSize: 20, fontFamily: 'Poppins_700Bold', color: '#fff', letterSpacing: -0.3,
    },
    headerSubtitle: {
      fontSize: 12, fontFamily: 'Poppins_400Regular', color: 'rgba(255,255,255,0.6)', marginTop: 2,
    },
    poolBar: {
      flexDirection: 'row',
      backgroundColor: t.colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: t.colors.border,
      paddingVertical: 8,
    },
    poolItem: { flex: 1, alignItems: 'center', gap: 2 },
    poolLabel: {
      fontSize: 11, fontFamily: 'Poppins_400Regular',
      color: t.colors.textSecondary, textAlign: 'center',
    },
    poolValue: {
      fontSize: 14, fontFamily: 'Poppins_700Bold', color: t.colors.textPrimary,
    },
    poolDivider: { width: 1, backgroundColor: t.colors.border },
    poolHint: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 16,
      paddingVertical: 6,
      backgroundColor: t.colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: t.colors.border,
    },
    poolHintText: {
      fontSize: 11,
      fontFamily: 'Poppins_400Regular',
      color: t.colors.textMuted,
      flex: 1,
    },
    statusBox: {
      alignItems: 'center',
      padding: 24,
      marginVertical: 8,
      backgroundColor: t.colors.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: t.colors.border,
      gap: 10,
    },
    statusBoxTitle: {
      fontSize: 16,
      fontFamily: 'Poppins_700Bold',
      color: t.colors.textPrimary,
      textAlign: 'center',
      marginTop: 4,
    },
    statusBoxText: {
      fontSize: 13,
      fontFamily: 'Poppins_400Regular',
      color: t.colors.textSecondary,
      textAlign: 'center',
      lineHeight: 18,
    },
    startedMatchBox: {
      marginTop: 12,
      padding: 12,
      width: '100%',
      backgroundColor: 'rgba(239,68,68,0.08)',
      borderRadius: 10,
      borderWidth: 1,
      borderColor: 'rgba(239,68,68,0.25)',
      alignItems: 'center',
      gap: 2,
    },
    startedMatchLabel: {
      fontSize: 10,
      fontFamily: 'Poppins_600SemiBold',
      color: '#EF4444',
      textTransform: 'uppercase' as const,
      letterSpacing: 0.6,
    },
    startedMatchName: {
      fontSize: 14,
      fontFamily: 'Poppins_700Bold',
      color: t.colors.textPrimary,
      marginTop: 2,
    },
    startedMatchTime: {
      fontSize: 12,
      fontFamily: 'Poppins_500Medium',
      color: t.colors.textSecondary,
    },
    startedMatchNow: {
      fontSize: 11,
      fontFamily: 'Poppins_400Regular',
      color: t.colors.textMuted,
      marginTop: 4,
    },
    startedMatchHint: {
      fontSize: 11,
      fontFamily: 'Poppins_400Regular',
      color: t.colors.warning,
      textAlign: 'center' as const,
      marginTop: 8,
      paddingHorizontal: 4,
      lineHeight: 16,
    },
    scrollView: { flex: 1 },
    scrollContent: { padding: 20, paddingBottom: 80 },
    existingSection: { marginBottom: 18 },
    sectionTitle: {
      fontSize: 16, fontFamily: 'Poppins_700Bold',
      color: t.colors.textPrimary, letterSpacing: -0.2, marginBottom: 8,
    },
    sectionHint: {
      fontSize: 12, fontFamily: 'Poppins_400Regular',
      color: t.colors.textSecondary, marginBottom: 14,
    },
    regTimeNote: {
      flexDirection: 'row', alignItems: 'flex-start', gap: 6,
      marginBottom: 14, marginTop: -4,
    },
    regTimeText: {
      flex: 1, fontSize: 11, fontFamily: 'Poppins_500Medium',
      color: t.colors.textMuted, lineHeight: 15, fontStyle: 'italic' as const,
    },
    editBanner: {
      flexDirection: 'row', alignItems: 'flex-start', gap: 8,
      padding: 10, marginBottom: 14,
      backgroundColor: 'rgba(245,158,11,0.08)',
      borderRadius: 12, borderWidth: 1,
      borderColor: 'rgba(245,158,11,0.25)',
    },
    editBannerText: {
      flex: 1, fontSize: 12, fontFamily: 'Poppins_400Regular', color: t.colors.warning,
    },
    existingTicketCard: {
      borderRadius: 14, borderWidth: 1, overflow: 'hidden',
      marginBottom: 8,
      borderColor: t.colors.border, backgroundColor: t.colors.surface,
    },
    existingTicketRow: {
      flexDirection: 'row', alignItems: 'center', gap: 4, padding: 12,
    },
    existingTicketAmount: {
      fontSize: 14, fontFamily: 'Poppins_600SemiBold', color: t.colors.textPrimary,
    },
    existingTicketDate: {
      fontSize: 12, fontFamily: 'Poppins_400Regular', color: t.colors.textSecondary,
    },
    matchCard: {
      borderRadius: 16, borderWidth: 1, overflow: 'hidden',
      marginBottom: 14,
      shadowColor: '#000', shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.14, shadowRadius: 8, elevation: 4,
    },
    matchCardLocked: {
      opacity: 0.75,
      borderColor: 'rgba(239,68,68,0.25)',
    },
    matchCardBody: { padding: 14 },
    matchDateRow: {
      flexDirection: 'row', alignItems: 'center',
      justifyContent: 'center', gap: 8, marginBottom: 10,
    },
    matchDate: {
      fontSize: 11, fontFamily: 'Poppins_400Regular',
      color: t.colors.textSecondary, textAlign: 'center',
    },
    lockedBadge: {
      flexDirection: 'row', alignItems: 'center', gap: 3,
      backgroundColor: 'rgba(239,68,68,0.12)',
      paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6,
    },
    lockedBadgeText: { fontSize: 10, fontFamily: 'Poppins_600SemiBold', color: '#EF4444' },
    pickedBadge: {
      flexDirection: 'row', alignItems: 'center', gap: 3,
      backgroundColor: 'rgba(34,197,94,0.12)',
      paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6,
    },
    pickedBadgeText: { fontSize: 10, fontFamily: 'Poppins_600SemiBold', color: t.colors.success },
    matchTeams: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 14,
    },
    teamColumn: { flex: 1, alignItems: 'center' },
    teamName: {
      fontSize: 12, fontFamily: 'Poppins_600SemiBold',
      color: t.colors.textPrimary, textAlign: 'center', marginTop: 4,
    },
    vsBlock: { alignItems: 'center', minWidth: 36 },
    vsText: { fontSize: 11, fontFamily: 'Poppins_700Bold', color: t.colors.textMuted },
    scoreText: { fontSize: 16, fontFamily: 'Poppins_700Bold', color: t.colors.textPrimary, marginTop: 2 },
    pickRow: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: 14 },
    pickButton: {
      flex: 1, minHeight: 44, paddingHorizontal: 6, paddingVertical: 8,
      borderRadius: 10, borderWidth: 1.5,
      borderColor: t.colors.border, backgroundColor: t.colors.surface,
      alignItems: 'center', justifyContent: 'center',
    },
    pickButtonDisabled: { opacity: 0.45 },
    pickButtonText: {
      fontSize: 11, fontFamily: 'Poppins_600SemiBold',
      color: t.colors.textSecondary, textAlign: 'center',
    },
    resultRow: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      marginTop: 10, paddingTop: 10,
      borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.colors.border,
    },
    resultLabel: { fontSize: 12, fontFamily: 'Poppins_400Regular', color: t.colors.textSecondary },
    resultValue: { flex: 1, fontSize: 12, fontFamily: 'Poppins_600SemiBold', color: t.colors.textPrimary },
    betSection: { marginBottom: 14 },
    betLabel: { fontSize: 16, fontFamily: 'Poppins_700Bold', color: t.colors.textPrimary, marginBottom: 4, letterSpacing: -0.2 },
    betHint:  { fontSize: 12, fontFamily: 'Poppins_400Regular', color: t.colors.textSecondary },
    submitSection: { marginTop: 18 },
    confirmHint: {
      flexDirection: 'row', alignItems: 'center', gap: 8,
      marginTop: 14, padding: 12,
      backgroundColor: 'rgba(245,158,11,0.1)',
      borderRadius: 12, borderWidth: 1,
      borderColor: 'rgba(245,158,11,0.3)',
    },
    confirmHintText: {
      fontSize: 12, fontFamily: 'Poppins_400Regular',
      color: t.colors.warning, flex: 1, lineHeight: 18,
    },
    cancelLink:     { alignItems: 'center', paddingVertical: 14 },
    cancelLinkText: { fontSize: 14, fontFamily: 'Poppins_400Regular', color: t.colors.textSecondary },
    noPicksHint: {
      fontSize: 12, fontFamily: 'Poppins_400Regular',
      color: t.colors.textMuted, textAlign: 'center', marginTop: 8,
    },
    resolvedSection: { marginTop: 18 },

    quickNavRow: { flexDirection: 'row', gap: 12, marginBottom: 20 },
    quickNavCard: {
      flex: 1, borderRadius: 16, paddingVertical: 18, paddingHorizontal: 12,
      alignItems: 'center', gap: 4,
      shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.22, shadowRadius: 8, elevation: 6,
    },
    quickNavCardBets:    { backgroundColor: '#10B981' },
    quickNavCardRanking: { backgroundColor: '#F59E0B' },
    quickNavIconWrap: {
      width: 52, height: 52, borderRadius: 26,
      backgroundColor: 'rgba(255,255,255,0.22)',
      alignItems: 'center', justifyContent: 'center', marginBottom: 6,
    },
    quickNavTitle: { fontSize: 14, fontFamily: 'Poppins_700Bold', color: '#fff' },
    quickNavSub: {
      fontSize: 11, fontFamily: 'Poppins_400Regular',
      color: 'rgba(255,255,255,0.82)', textAlign: 'center',
    },

    // ── Confirmation Modal ────────────────────────────────────────────────────
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.6)',
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 24,
    },
    modalCard: {
      width: '100%',
      backgroundColor: t.colors.surface,
      borderRadius: 24,
      padding: 24,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.3,
      shadowRadius: 24,
      elevation: 12,
      borderWidth: 1,
      borderColor: t.colors.border,
    },
    modalIconWrap: {
      alignSelf: 'center',
      width: 68,
      height: 68,
      borderRadius: 34,
      backgroundColor: t.colors.primary + '18',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 14,
    },
    modalTitle: {
      fontSize: 20,
      fontFamily: 'Poppins_700Bold',
      color: t.colors.textPrimary,
      textAlign: 'center',
      marginBottom: 4,
    },
    modalSubtitle: {
      fontSize: 13,
      fontFamily: 'Poppins_400Regular',
      color: t.colors.textSecondary,
      textAlign: 'center',
      marginBottom: 20,
      lineHeight: 18,
    },
    modalPicksList: {
      gap: 8,
      marginBottom: 24,
    },
    modalPickRow: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      justifyContent: 'space-between' as const,
      paddingHorizontal: 12,
      paddingVertical: 10,
      backgroundColor: t.colors.bg,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: t.colors.border,
      gap: 8,
    },
    modalPickMatch: {
      flex: 1,
      fontSize: 12,
      fontFamily: 'Poppins_500Medium',
      color: t.colors.textPrimary,
    },
    modalPickBadge: {
      paddingHorizontal: 9,
      paddingVertical: 4,
      borderRadius: 8,
    },
    modalPickBadgeText: {
      fontSize: 11,
      fontFamily: 'Poppins_600SemiBold',
      color: '#fff',
    },
    modalNoPickRow: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 8,
      backgroundColor: t.colors.bg,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: t.colors.border,
      opacity: 0.6,
    },
    modalNoPickText: {
      fontSize: 12,
      fontFamily: 'Poppins_400Regular',
      color: t.colors.textMuted,
    },
    modalButtons: {
      flexDirection: 'row' as const,
      gap: 12,
    },
    modalCancelBtn: {
      flex: 1,
      height: 50,
      borderRadius: 14,
      borderWidth: 1.5,
      borderColor: t.colors.border,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
    },
    modalCancelText: {
      fontSize: 15,
      fontFamily: 'Poppins_600SemiBold',
      color: t.colors.textSecondary,
    },
    modalConfirmBtn: {
      flex: 1,
      height: 50,
      borderRadius: 14,
      backgroundColor: t.colors.primary,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
    },
    modalConfirmText: {
      fontSize: 15,
      fontFamily: 'Poppins_700Bold',
      color: '#fff',
    },
  });
}
