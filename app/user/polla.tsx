import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Pressable,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useFocusEffect } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Skeleton } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { TeamFlag } from '../../components/ui/TeamFlag';
import { useToast } from '../../components/ui/Toast';
import { useTheme } from '../../contexts/ThemeContext';
import { theme as staticTheme } from '../../constants/theme';
import api from '../../services/api';
import { usePollaFinalEnabled } from '../../hooks/useAppSettings';
import { Redirect } from 'expo-router';

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
            const inscritosCount = Number(t?._count?.participants ?? t?.participants?.length ?? 0);
            const betFinal       = Number(t?.bet_final ?? 0);
            const grandPrize     = jornadasCount * inscritosCount * betFinal;
            const cur            = t?.currency ?? 'Bs';
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
                <View style={styles.pozoGordoBox}>
                  <LinearGradient
                    colors={['#FFD700', '#FFA500', '#D4A017']}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                    style={styles.pozoGordoGradient}
                  >
                    <Text style={styles.pozoGordoLabel}>PREMIO GORDO</Text>
                    <Text style={styles.pozoGordoValue}>{cur} {grandPrize}</Text>
                    <Text style={styles.pozoGordoFormula}>
                      {jornadasCount} jornadas × {inscritosCount} inscritos × {cur} {betFinal}
                    </Text>
                  </LinearGradient>
                </View>
                <View style={styles.tieRow}>
                  <Ionicons name="information-circle-outline" size={11} color={theme.colors.textMuted} />
                  <Text style={styles.tieText}>
                    Si hay empate en la predicción del podio, el pozo se reparte entre los ganadores
                  </Text>
                </View>

                {hasBet ? (
                  <View style={styles.betSummary}>
                    <Text style={styles.betLabel}>Tu predicción:</Text>
                    <BetPickRow label="🥇 1°" pickId={myBet?.pick_1st} pts="12 pts" />
                    <BetPickRow label="🥈 2°" pickId={myBet?.pick_2nd} pts="8 pts" />
                    <BetPickRow label="🥉 3°" pickId={myBet?.pick_3rd} pts="4 pts" />
                    <BetPickRow label="4️⃣ 4°" pickId={myBet?.pick_4th} pts="2 pts" />
                    {myBet?.status === 'won' && (
                      <View style={styles.wonBadge}>
                        <Text style={styles.wonText}>Ganaste {t?.currency ?? 'Bs'} {Number(myBet?.prize_won ?? 0).toFixed(2)}</Text>
                      </View>
                    )}
                    {myBet?.status === 'lost' && (
                      <View style={[styles.wonBadge, { backgroundColor: 'rgba(239,68,68,0.15)' }]}>
                        <Text style={[styles.wonText, { color: '#EF4444' }]}>{myBet?.total_points ?? 0} puntos - No ganaste</Text>
                      </View>
                    )}
                  </View>
                ) : (
                  <Pressable style={styles.betButton} onPress={() => openBetModal(t)}>
                    <Ionicons name="star" size={20} color="#FFF" />
                    <Text style={styles.betButtonText}>Hacer mi Predicción</Text>
                  </Pressable>
                )}
              </Card>
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

function BetPickRow({ label, pickId, pts }: { label: string; pickId?: string; pts: string }) {
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { data: teams } = useQuery({
    queryKey: ['teams'],
    queryFn: async () => {
      const res = await api.get('/api/teams');
      return res?.data ?? [];
    },
    staleTime: 60000,
  });
  const team = (teams ?? []).find((t: any) => t?.id === pickId);
  return (
    <View style={styles.pickRow}>
      <Text style={styles.pickLabel}>{label}</Text>
      <View style={styles.pickTeam}>
        {team && <TeamFlag team={team} size={22} />}
        <Text style={styles.pickName}>{team?.name ?? 'Sin seleccionar'}</Text>
      </View>
      <Text style={styles.pickPts}>{pts}</Text>
    </View>
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
    content: { padding: 20, paddingBottom: 80 },
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
    pozoGordoLabel: {
      fontSize: 10,
      fontFamily: 'Poppins_800ExtraBold',
      color: '#7B5A00',
      letterSpacing: 1.4,
    },
    pozoGordoValue: {
      fontSize: 30,
      fontFamily: 'Poppins_800ExtraBold',
      color: '#3D2A00',
      letterSpacing: -0.8,
      marginTop: 2,
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
    betSummary: { backgroundColor: t.colors.surfaceElevated, borderRadius: 12, padding: 8 },
    betLabel: { fontSize: 12, fontFamily: 'Poppins_700Bold', color: t.colors.primaryLight, marginBottom: 6 },
    pickRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 5 },
    pickLabel: { color: t.colors.textSecondary, fontSize: 13, width: 50 },
    pickTeam: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
    pickName: { color: t.colors.textPrimary, fontSize: 14, fontFamily: 'Poppins_600SemiBold' },
    pickPts: { color: t.colors.textMuted, fontSize: 11 },
    wonBadge: {
      backgroundColor: 'rgba(16,185,129,0.15)',
      borderRadius: 8,
      paddingVertical: 6,
      paddingHorizontal: 10,
      marginTop: 8,
      alignItems: 'center',
    },
    wonText: { color: '#10B981', fontFamily: 'Poppins_700Bold', fontSize: 14 },
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