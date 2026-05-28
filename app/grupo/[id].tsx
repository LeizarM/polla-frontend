import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, router } from 'expo-router';
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

interface TeamInfo {
  id: string;
  name: string;
  country: string;
  shield_url?: string;
}

function formatCurrency(amount: number): string {
  return `Bs ${Number(amount ?? 0).toFixed(2)}`;
}

const POSITION_LABELS = ['1°', '2°', '3°', '4°'];

export default function GroupDetailScreen() {
  const { id = '' } = useLocalSearchParams<{ id: string }>();
  const { user, refreshUser } = useAuthStore();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const POSITION_COLORS = [
    theme.colors.gold,
    theme.colors.silver,
    '#CD7F32',
    theme.colors.textSecondary,
  ];

  // Picks state: position -> team_id
  const [picks, setPicks] = useState<Record<number, string>>({});
  const [betAmount, setBetAmount] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);

  const { data: group, isLoading } = useQuery({
    queryKey: ['group-detail', id],
    queryFn: async () => {
      if (!id) return null;
      const res = await api.get(`/api/groups/${id}`);
      return res?.data ?? null;
    },
    enabled: !!id,
  });

  const { data: myBets } = useQuery({
    queryKey: ['my-group-bets-for-group', id],
    queryFn: async () => {
      if (!id) return [];
      const res = await api.get('/api/group-bets/me');
      const all = res?.data ?? [];
      return all.filter((b: any) => b?.group_id === id);
    },
    enabled: !!id,
  });

  const teams: TeamInfo[] = group?.teams ?? [];
  const tournament = group?.tournament;
  const isOpen = group?.status === 'open';
  const hasThirdPlace = group?.has_third_place ?? false;
  const positionsNeeded = hasThirdPlace ? (teams?.length >= 4 ? 4 : teams?.length) : 2;
  const minBet = Number(tournament?.min_bet ?? 10);
  const maxBet = Number(tournament?.max_bet ?? 1000);
  const totalPool = group?.total_pool ?? 0;
  const existingBets = myBets ?? [];

  const parsedBet = parseFloat(betAmount) || 0;
  const allPicked = Object.keys(picks)?.length >= positionsNeeded;
  const canSubmit = allPicked && parsedBet >= minBet && parsedBet <= maxBet && parsedBet <= (user?.balance ?? 0);

  const handlePickTeam = useCallback((position: number, teamId: string) => {
    setPicks((prev) => {
      const next = { ...prev };
      // Remove team from any other position
      Object.keys(next).forEach((key) => {
        if (next[Number(key)] === teamId) {
          delete next[Number(key)];
        }
      });
      // If already in this position, deselect
      if (prev[position] === teamId) {
        delete next[position];
      } else {
        next[position] = teamId;
      }
      return next;
    });
    if (Platform.OS !== 'web') {
      Haptics.impactAsync?.(Haptics.ImpactFeedbackStyle.Light);
    }
    showToast('info', getRandomBetMessage());
  }, [showToast]);

  const submitMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post('/api/group-bets', {
        group_id: id,
        amount_bet: parsedBet,
        pick_1st: picks[0],
        pick_2nd: picks[1],
        pick_3rd: picks[2] || null,
        pick_4th: picks[3] || null,
      });
      return res?.data;
    },
    onSuccess: () => {
      showToast('success', '¡Apuesta de grupo registrada! 🏆');
      queryClient.invalidateQueries({ queryKey: ['my-group-bets-for-group', id] });
      queryClient.invalidateQueries({ queryKey: ['group-detail', id] });
      queryClient.invalidateQueries({ queryKey: ['my-group-bets'] });
      queryClient.invalidateQueries({ queryKey: ['user-groups'] });
      refreshUser();
      setPicks({});
      setBetAmount('');
      setShowConfirm(false);
    },
    onError: (error: any) => {
      const msg = error?.response?.data?.message || error?.friendlyMessage || 'Error al apostar';
      showToast('error', typeof msg === 'string' ? msg : 'Error al apostar');
      setShowConfirm(false);
    },
  });

  const getTeamForPosition = (pos: number): TeamInfo | undefined => {
    const tid = picks[pos];
    return tid ? teams.find((t) => t?.id === tid) : undefined;
  };

  const isTeamUsed = (teamId: string): number | null => {
    for (const [pos, tid] of Object.entries(picks)) {
      if (tid === teamId) return Number(pos);
    }
    return null;
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Skeleton width={'80%' as any} height={28} />
          <Skeleton width={'60%' as any} height={18} style={{ marginTop: 8 }} />
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} style={{ marginTop: 16, padding: 16 }}>
              <Skeleton width={'100%' as any} height={40} />
            </Card>
          ))}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Header */}
        <Animated.View entering={FadeIn.duration(400)}>
          <LinearGradient
            colors={[theme.colors.primary, theme.colors.primaryLight]}
            start={{ x: 0, y: 0 }} end={{ x: 0.7, y: 1 }}
            style={styles.header}
          >
            <Pressable onPress={() => safeGoBack('/user')} style={styles.backButton}>
              <Ionicons name="arrow-back" size={20} color="rgba(255,255,255,0.85)" />
            </Pressable>
            <View style={styles.headerInfo}>
              <Text style={styles.headerTitle} numberOfLines={1}>
                {group?.name ?? 'Grupo'}
              </Text>
              <Text style={styles.headerSubtitle} numberOfLines={1}>
                {tournament?.name ?? 'Torneo'}
              </Text>
            </View>
            <Badge status={group?.status as any ?? 'pending'} />
          </LinearGradient>
        </Animated.View>

        {/* Pool Info */}
        <View style={styles.poolBar}>
          <View style={styles.poolItem}>
            <Ionicons name="cash-outline" size={16} color={theme.colors.success} />
            <Text style={styles.poolLabel}>Pozo</Text>
            <Text style={styles.poolValue}>{formatCurrency(totalPool)}</Text>
          </View>
          <View style={styles.poolDivider} />
          <View style={styles.poolItem}>
            <Ionicons name="people-outline" size={16} color={theme.colors.primaryLight} />
            <Text style={styles.poolLabel}>Equipos</Text>
            <Text style={styles.poolValue}>{teams?.length ?? 0}</Text>
          </View>
          <View style={styles.poolDivider} />
          <View style={styles.poolItem}>
            <Ionicons name="podium-outline" size={16} color={theme.colors.gold} />
            <Text style={styles.poolLabel}>Posiciones</Text>
            <Text style={styles.poolValue}>{positionsNeeded}</Text>
          </View>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Existing bets */}
          {existingBets?.length > 0 && (
            <View style={styles.existingSection}>
              <Text style={styles.sectionTitle}>Tus Apuestas</Text>
              {existingBets.map((bet: any) => (
                <Card key={bet?.id} style={styles.existingBetCard}>
                  <View style={styles.existingBetRow}>
                    <Ionicons name="trophy" size={20} color={theme.colors.gold} />
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <Text style={styles.existingBetAmount}>
                        Apuesta: {formatCurrency(bet?.amount_bet ?? 0)}
                      </Text>
                      <Text style={styles.existingBetDate}>
                        {bet?.total_points != null
                          ? `Puntos: ${bet.total_points}`
                          : 'Pendiente'}
                      </Text>
                    </View>
                    <Badge status={bet?.status as any ?? 'active'} />
                  </View>
                </Card>
              ))}
            </View>
          )}

          {/* Points table */}
          <Card style={styles.pointsCard}>
            <Text style={styles.pointsTitle}>Puntos por posición</Text>
            <View style={styles.pointsRow}>
              <View style={styles.pointItem}>
                <Text style={[styles.pointEmoji]}>🥇</Text>
                <Text style={styles.pointValue}>{group?.pts_1st ?? 10} pts</Text>
              </View>
              <View style={styles.pointItem}>
                <Text style={styles.pointEmoji}>🥈</Text>
                <Text style={styles.pointValue}>{group?.pts_2nd ?? 5} pts</Text>
              </View>
              {hasThirdPlace && group?.pts_3rd != null && (
                <View style={styles.pointItem}>
                  <Text style={styles.pointEmoji}>🥉</Text>
                  <Text style={styles.pointValue}>{group.pts_3rd} pts</Text>
                </View>
              )}
              {hasThirdPlace && group?.pts_4th != null && (
                <View style={styles.pointItem}>
                  <Text style={styles.pointEmoji}>4°</Text>
                  <Text style={styles.pointValue}>{group.pts_4th} pts</Text>
                </View>
              )}
            </View>
          </Card>

          {/* Position picks */}
          {isOpen && (
            <>
              <Text style={styles.sectionTitle}>Elige las Posiciones</Text>
              <Text style={styles.sectionHint}>
                Selecciona un equipo para cada posición
              </Text>

              {Array.from({ length: positionsNeeded }, (_, pos) => {
                const selectedTeam = getTeamForPosition(pos);
                return (
                  <Animated.View
                    key={pos}
                    entering={FadeInDown.delay(pos * 80).duration(350)}
                  >
                    <View style={styles.positionSection}>
                      <View style={styles.positionHeader}>
                        <View style={[styles.positionBadge, { borderColor: POSITION_COLORS[pos] ?? theme.colors.textSecondary }]}>
                          <Text style={[styles.positionLabel, { color: POSITION_COLORS[pos] ?? theme.colors.textSecondary }]}>
                            {POSITION_LABELS[pos] ?? `${pos + 1}°`}
                          </Text>
                        </View>
                        <Text style={styles.positionTitle}>
                          {pos === 0 ? 'Primer lugar' : pos === 1 ? 'Segundo lugar' : pos === 2 ? 'Tercer lugar' : 'Cuarto lugar'}
                        </Text>
                        {selectedTeam && (
                          <View style={styles.selectedTeamBadge}>
                            <Text style={styles.selectedTeamText}>{selectedTeam?.name}</Text>
                          </View>
                        )}
                      </View>

                      <View style={styles.teamsGrid}>
                        {teams.map((team: TeamInfo) => {
                          const usedInPos = isTeamUsed(team?.id);
                          const isSelected = picks[pos] === team?.id;
                          const isUsedElsewhere = usedInPos !== null && usedInPos !== pos;

                          return (
                            <Pressable
                              key={team?.id}
                              style={[
                                styles.teamChip,
                                isSelected && styles.teamChipSelected,
                                isUsedElsewhere && styles.teamChipUsed,
                              ]}
                              onPress={() => {
                                if (!isUsedElsewhere) {
                                  handlePickTeam(pos, team?.id);
                                }
                              }}
                              disabled={isUsedElsewhere}
                            >
                              <TeamFlag team={team} size={22} />
                              <Text style={[
                                styles.teamChipName,
                                isSelected && { color: '#fff', fontFamily: 'Poppins_700Bold' },
                                isUsedElsewhere && { color: theme.colors.textMuted },
                              ]} numberOfLines={1}>
                                {team?.name ?? 'Equipo'}
                              </Text>
                              {isUsedElsewhere && (
                                <Text style={styles.teamChipUsedLabel}>
                                  {POSITION_LABELS[usedInPos ?? 0]}
                                </Text>
                              )}
                            </Pressable>
                          );
                        })}
                      </View>
                    </View>
                  </Animated.View>
                );
              })}

              {/* Bet amount */}
              <View style={styles.betSection}>
                <Text style={styles.betLabel}>Monto de apuesta</Text>
                <Text style={styles.betHint}>
                  Mín: {formatCurrency(minBet)} • Máx: {formatCurrency(maxBet)} • Saldo: {formatCurrency(user?.balance ?? 0)}
                </Text>
                <View style={styles.betInputRow}>
                  <Text style={styles.currencySign}>$</Text>
                  <TextInput
                    style={styles.betInput}
                    value={betAmount}
                    onChangeText={setBetAmount}
                    keyboardType="numeric"
                    placeholder={`${minBet}`}
                    placeholderTextColor={theme.colors.textMuted}
                    maxLength={10}
                  />
                </View>
                <View style={styles.quickBets}>
                  {[minBet, 50, 100, 200, 500].filter(v => v <= maxBet && v <= (user?.balance ?? 0)).map((v) => (
                    <Pressable
                      key={v}
                      style={[
                        styles.quickBetChip,
                        parsedBet === v && styles.quickBetChipActive,
                      ]}
                      onPress={() => setBetAmount(String(v))}
                    >
                      <Text style={[
                        styles.quickBetText,
                        parsedBet === v && styles.quickBetTextActive,
                      ]}>
                        ${v}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              {/* Submit */}
              <View style={styles.submitSection}>
                <Button
                  title={showConfirm ? 'Confirmar Apuesta' : `Apostar ${parsedBet > 0 ? formatCurrency(parsedBet) : ''}`}
                  variant="accent"
                  fullWidth
                  size="lg"
                  icon={showConfirm ? 'checkmark-circle' : 'trophy'}
                  disabled={!canSubmit}
                  loading={submitMutation?.isPending}
                  onPress={() => {
                    if (showConfirm) {
                      submitMutation.mutate();
                    } else {
                      setShowConfirm(true);
                    }
                  }}
                />
                {showConfirm && (
                  <Animated.View entering={FadeIn.duration(300)} style={styles.confirmHint}>
                    <Ionicons name="warning" size={16} color={theme.colors.warning} />
                    <Text style={styles.confirmHintText}>
                      Se descontarán {formatCurrency(parsedBet)} de tu saldo. ¿Confirmas?
                    </Text>
                  </Animated.View>
                )}
                {showConfirm && (
                  <Pressable onPress={() => setShowConfirm(false)} style={styles.cancelLink}>
                    <Text style={styles.cancelLinkText}>Cancelar</Text>
                  </Pressable>
                )}
              </View>
            </>
          )}

          {/* If resolved, show results */}
          {(group?.status === 'resolved' || group?.status === 'finished') && (
            <View style={styles.resolvedSection}>
              <Text style={styles.sectionTitle}>Resultados Oficiales</Text>
              {group?.result_1st && (
                <View style={styles.resultRow}>
                  <Text style={styles.resultMedal}>🥇</Text>
                  <Text style={styles.resultTeam}>
                    {teams.find((t: TeamInfo) => t?.id === group.result_1st)?.name ?? '1°'}
                  </Text>
                </View>
              )}
              {group?.result_2nd && (
                <View style={styles.resultRow}>
                  <Text style={styles.resultMedal}>🥈</Text>
                  <Text style={styles.resultTeam}>
                    {teams.find((t: TeamInfo) => t?.id === group.result_2nd)?.name ?? '2°'}
                  </Text>
                </View>
              )}
              {group?.result_3rd && (
                <View style={styles.resultRow}>
                  <Text style={styles.resultMedal}>🥉</Text>
                  <Text style={styles.resultTeam}>
                    {teams.find((t: TeamInfo) => t?.id === group.result_3rd)?.name ?? '3°'}
                  </Text>
                </View>
              )}
              {group?.result_4th && (
                <View style={styles.resultRow}>
                  <Text style={styles.resultMedal}>4°</Text>
                  <Text style={styles.resultTeam}>
                    {teams.find((t: TeamInfo) => t?.id === group.result_4th)?.name ?? '4°'}
                  </Text>
                </View>
              )}
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
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
    headerInfo: { flex: 1, marginLeft: 10, marginRight: 10 },
    headerTitle: { fontSize: 20, fontFamily: 'Poppins_700Bold', color: '#fff', letterSpacing: -0.3 },
    headerSubtitle: { fontSize: 12, fontFamily: 'Poppins_400Regular', color: 'rgba(255,255,255,0.6)', marginTop: 2 },
    poolBar: {
      flexDirection: 'row', backgroundColor: t.colors.surface,
      borderBottomWidth: 1, borderBottomColor: t.colors.border, paddingVertical: 8,
    },
    poolItem: { flex: 1, alignItems: 'center', gap: 2 },
    poolLabel: { fontSize: 11, fontFamily: 'Poppins_400Regular', color: t.colors.textSecondary },
    poolValue: { fontSize: 14, fontFamily: 'Poppins_700Bold', color: t.colors.textPrimary },
    poolDivider: { width: 1, backgroundColor: t.colors.border },
    scrollView: { flex: 1 },
    scrollContent: { padding: 20, paddingBottom: 80 },
    existingSection: { marginBottom: 18 },
    sectionTitle: { fontSize: 16, fontFamily: 'Poppins_700Bold', color: t.colors.textPrimary, letterSpacing: -0.2, marginBottom: 8 },
    sectionHint: { fontSize: 12, fontFamily: 'Poppins_400Regular', color: t.colors.textSecondary, marginBottom: 14 },
    existingBetCard: { padding: 10, marginBottom: 8 },
    existingBetRow: { flexDirection: 'row', alignItems: 'center' },
    existingBetAmount: { fontSize: 14, fontFamily: 'Poppins_600SemiBold', color: t.colors.textPrimary },
    existingBetDate: { fontSize: 12, fontFamily: 'Poppins_400Regular', color: t.colors.textSecondary },
    pointsCard: { padding: 14, marginBottom: 18 },
    pointsTitle: { fontSize: 14, fontFamily: 'Poppins_600SemiBold', color: t.colors.textPrimary, marginBottom: 10, textAlign: 'center' },
    pointsRow: { flexDirection: 'row', justifyContent: 'center', gap: 24 },
    pointItem: { alignItems: 'center' },
    pointEmoji: { fontSize: 24 },
    pointValue: { fontSize: 12, fontFamily: 'Poppins_400Regular', color: t.colors.textSecondary, marginTop: 2 },
    positionSection: { marginBottom: 18 },
    positionHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
    positionBadge: {
      width: 36, height: 36, borderRadius: 18, borderWidth: 2,
      alignItems: 'center', justifyContent: 'center', backgroundColor: t.colors.surface,
    },
    positionLabel: { fontSize: 14, fontFamily: 'Poppins_700Bold' },
    positionTitle: { fontSize: 14, fontFamily: 'Poppins_600SemiBold', color: t.colors.textPrimary },
    selectedTeamBadge: {
      marginLeft: 'auto', paddingHorizontal: 10, paddingVertical: 3,
      borderRadius: 20, backgroundColor: t.colors.primaryLight + '20',
      borderWidth: 1, borderColor: t.colors.primaryLight,
    },
    selectedTeamText: { fontSize: 11, fontFamily: 'Poppins_600SemiBold', color: t.colors.primaryLight },
    teamsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    teamChip: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      paddingHorizontal: 12, paddingVertical: 10,
      borderRadius: 12, backgroundColor: t.colors.surface,
      borderWidth: 1.5, borderColor: t.colors.border,
    },
    teamChipSelected: { backgroundColor: t.colors.primaryLight, borderColor: t.colors.primaryLight },
    teamChipUsed: { opacity: 0.4 },
    teamChipFlag: { fontSize: 18 },
    teamChipName: { fontSize: 12, fontFamily: 'Poppins_500Medium', color: t.colors.textPrimary },
    teamChipUsedLabel: { fontSize: 10, fontFamily: 'Poppins_400Regular', color: t.colors.textMuted },
    betSection: { marginTop: 18, marginBottom: 14 },
    betLabel: { fontSize: 16, fontFamily: 'Poppins_700Bold', color: t.colors.textPrimary, marginBottom: 4, letterSpacing: -0.2 },
    betHint:  { fontSize: 12, fontFamily: 'Poppins_400Regular', color: t.colors.textSecondary, marginBottom: 14 },
    betInputRow: {
      flexDirection: 'row', alignItems: 'center',
      backgroundColor: t.colors.surface, borderRadius: 14,
      borderWidth: 1, borderColor: t.colors.border,
      paddingHorizontal: 16, height: 52,
    },
    currencySign: { fontSize: 20, fontFamily: 'Poppins_700Bold', color: t.colors.textSecondary, marginRight: 4 },
    betInput: { flex: 1, fontSize: 20, fontFamily: 'Poppins_700Bold', color: t.colors.textPrimary, padding: 0 },
    quickBets: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
    quickBetChip: {
      paddingHorizontal: 14, paddingVertical: 8,
      borderRadius: 20, backgroundColor: t.colors.surface,
      borderWidth: 1, borderColor: t.colors.border,
    },
    quickBetChipActive: { backgroundColor: t.colors.primaryLight, borderColor: t.colors.primaryLight },
    quickBetText: { fontSize: 12, fontFamily: 'Poppins_600SemiBold', color: t.colors.textSecondary },
    quickBetTextActive: { color: '#fff' },
    submitSection: { marginTop: 18 },
    confirmHint: {
      flexDirection: 'row', alignItems: 'center', gap: 8,
      marginTop: 14, padding: 12,
      backgroundColor: 'rgba(245,158,11,0.1)',
      borderRadius: 12, borderWidth: 1, borderColor: 'rgba(245,158,11,0.3)',
    },
    confirmHintText: { fontSize: 12, fontFamily: 'Poppins_400Regular', color: t.colors.warning, flex: 1, lineHeight: 18 },
    cancelLink: { alignItems: 'center', paddingVertical: 14 },
    cancelLinkText: { fontSize: 14, fontFamily: 'Poppins_400Regular', color: t.colors.textSecondary },
    resolvedSection: { marginTop: 18 },
    resultRow: {
      flexDirection: 'row', alignItems: 'center', gap: 16,
      paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.colors.border,
    },
    resultMedal: { fontSize: 28 },
    resultTeam: { fontSize: 14, fontFamily: 'Poppins_600SemiBold', color: t.colors.textPrimary },
  });
}
