import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Pressable,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useFocusEffect } from '@react-navigation/native';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Skeleton } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import { Modal } from '../../components/ui/Modal';
import { useToast } from '../../components/ui/Toast';
import { useTheme } from '../../contexts/ThemeContext';
import { theme as staticTheme } from '../../constants/theme';
import api from '../../services/api';
import { downloadPdf } from '../../services/downloadPdf';
import { usePollaFinalEnabled, useUpdateAppSetting } from '../../hooks/useAppSettings';

export default function AdminPollaScreen() {
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const [selectedTournament, setSelectedTournament] = useState<any>(null);
  const [showResolveModal, setShowResolveModal] = useState(false);

  // ── Visibilidad pública de la Polla Final ─────────────────────────────────
  // Cuando está OFF, los usuarios NO ven la pestaña en su tab bar / sidebar.
  // El admin sí la sigue viendo siempre para poder reactivarla.
  const { enabled: pollaEnabled, isLoading: pollaSettingLoading } = usePollaFinalEnabled();
  const updateSetting = useUpdateAppSetting();
  const togglePolla = (next: boolean) => {
    updateSetting.mutate(
      { polla_final_enabled: next ? 'true' : 'false' },
      {
        onSuccess: () => {
          showToast('success', next ? 'Polla Final visible para usuarios' : 'Polla Final oculta');
        },
        onError: (e: any) => {
          showToast('error', e?.response?.data?.message ?? 'No se pudo actualizar');
        },
      },
    );
  };

  const { data: tournaments, isLoading, refetch } = useQuery({
    queryKey: ['admin-tournaments-polla'],
    queryFn: async () => {
      try {
        const res = await api.get('/api/tournaments');
        return res?.data ?? [];
      } catch { return []; }
    },
  });

  useFocusEffect(useCallback(() => { refetch(); }, []));

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const [reportData, setReportData] = useState<any>(null);
  const [showReport, setShowReport] = useState(false);

  const viewReport = async (tournamentId: string) => {
    try {
      const res = await api.get(`/api/final-bets/tournament/${tournamentId}/report`);
      setReportData(res?.data);
      setShowReport(true);
    } catch (error: any) {
      showToast('error', error?.response?.data?.message || 'Error al cargar reporte');
    }
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
            <Text style={styles.headerSubtitle}>Gestiona y resuelve pollas finales</Text>
          </View>
        </View>
      </LinearGradient>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primaryLight} />}
      >
        {/* ─── Switch: visibilidad pública de la Polla Final ─────────── */}
        <View style={[styles.visibilityCard, {
          backgroundColor: pollaEnabled ? '#10B98112' : theme.colors.surface,
          borderColor: pollaEnabled ? '#10B98140' : theme.colors.border,
        }]}>
          <View style={[styles.visibilityIcon, {
            backgroundColor: pollaEnabled ? '#10B98120' : theme.colors.inputBg,
          }]}>
            <Ionicons
              name={pollaEnabled ? 'eye' : 'eye-off'}
              size={20}
              color={pollaEnabled ? '#10B981' : theme.colors.textMuted}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.visibilityTitle, { color: theme.colors.textPrimary }]}>
              {pollaEnabled ? 'Polla Final visible' : 'Polla Final oculta'}
            </Text>
            <Text style={[styles.visibilityHint, { color: theme.colors.textMuted }]}>
              {pollaEnabled
                ? 'Los usuarios ven la pestaña en su menú. Apaga para ocultarla.'
                : 'Los usuarios NO ven la pestaña. Activa para hacerla visible.'}
            </Text>
          </View>
          <Switch
            value={pollaEnabled}
            onValueChange={togglePolla}
            disabled={pollaSettingLoading || updateSetting.isPending}
            trackColor={{ false: theme.colors.border, true: '#10B981' }}
            thumbColor="#fff"
          />
        </View>

        {isLoading ? (
          [1, 2].map(i => <Skeleton key={i} width="100%" height={100} style={{ marginBottom: 12 }} />)
        ) : (tournaments?.length ?? 0) === 0 ? (
          <EmptyState icon="star-outline" title="Sin torneos" description="Crea un torneo primero" />
        ) : (
          (tournaments ?? []).map((t: any) => (
            <Card key={t?.id} style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>{t?.name}</Text>
                  <Text style={styles.cardInfo}>
                    {t?.currency ?? 'Bs'} {Number(t?.bet_final ?? 0)}/jornada · {t?._count?.matchdays ?? 0} jornadas · {t?._count?.final_bets ?? 0} apuestas
                  </Text>
                </View>
                <Badge status={t?.status === 'active' ? 'active' : t?.status === 'finished' ? 'approved' : 'pending'} text={t?.status} />
              </View>

              <View style={styles.cardActions}>
                <Pressable style={styles.actionBtn} onPress={() => viewReport(t?.id)}>
                  <Ionicons name="document-text" size={18} color="#0052CC" />
                  <Text style={[styles.actionText, { color: '#0052CC' }]}>Reporte</Text>
                </Pressable>
                <Pressable
                  style={[styles.actionBtn, { borderColor: theme.colors.accent }]}
                  onPress={() => {
                    downloadPdf(`/api/reports/tournament/${t?.id}/polla-final/pdf`, `polla-final-${(t?.name ?? 'torneo').replace(/\s/g, '-')}.pdf`)
                      .catch(() => showToast('error', 'Error al descargar PDF'));
                  }}
                >
                  <Ionicons name="download" size={18} color={theme.colors.accent} />
                  <Text style={[styles.actionText, { color: theme.colors.accent }]}>PDF</Text>
                </Pressable>
                <Pressable
                  style={[styles.actionBtn, { borderColor: '#F59E0B' }]}
                  onPress={() => { setSelectedTournament(t); setShowResolveModal(true); }}
                >
                  <Ionicons name="trophy" size={18} color="#F59E0B" />
                  <Text style={[styles.actionText, { color: '#F59E0B' }]}>Resolver</Text>
                </Pressable>
              </View>
            </Card>
          ))
        )}
      </ScrollView>

      {showResolveModal && selectedTournament && (
        <ResolveModal
          visible={showResolveModal}
          tournament={selectedTournament}
          onClose={() => setShowResolveModal(false)}
          onSuccess={() => {
            setShowResolveModal(false);
            refetch();
          }}
        />
      )}

      {showReport && reportData && (
        <Modal visible={showReport} onClose={() => setShowReport(false)}>
          <ScrollView style={{ maxHeight: 500 }}>
            <Text style={{ ...theme.typography.h3, color: theme.colors.textPrimary, marginBottom: 8 }}>
              ⭐ Reporte Polla Final
            </Text>
            <Text style={{ color: theme.colors.textSecondary, fontSize: 13, marginBottom: 4 }}>
              {reportData?.tournament?.name} · Pozo: {reportData?.tournament?.currency ?? 'Bs'} {Number(reportData?.pool ?? 0).toFixed(2)}
            </Text>
            <Text style={{ color: theme.colors.textSecondary, fontSize: 13, marginBottom: 12 }}>
              Apostaron: {reportData?.participant_count ?? 0} · Pendientes: {reportData?.pending_count ?? 0}
            </Text>

            {(reportData?.bets?.length ?? 0) > 0 && (
              <>
                <Text style={{ color: theme.colors.primaryLight, fontFamily: 'Poppins_700Bold', fontSize: 13, marginBottom: 6 }}>Apuestas:</Text>
                {(reportData?.bets ?? []).map((b: any, i: number) => (
                  <Text key={i} style={{ color: theme.colors.textPrimary, fontSize: 12, marginBottom: 3 }}>
                    {b?.position}. {b?.full_name ?? b?.username} — {b?.total_points ?? 0} pts {b?.status === 'won' ? '🏆' : ''}
                  </Text>
                ))}
              </>
            )}

            {(reportData?.pending_users?.length ?? 0) > 0 && (
              <>
                <Text style={{ color: '#F59E0B', fontFamily: 'Poppins_700Bold', fontSize: 13, marginTop: 12, marginBottom: 6 }}>⚠️ No han apostado:</Text>
                {(reportData?.pending_users ?? []).map((u: any, i: number) => (
                  <Text key={i} style={{ color: theme.colors.textSecondary, fontSize: 12, marginBottom: 3 }}>
                    {i + 1}. {u?.full_name} (@{u?.username})
                  </Text>
                ))}
              </>
            )}
          </ScrollView>
        </Modal>
      )}
    </SafeAreaView>
  );
}

function ResolveModal({ visible, tournament, onClose, onSuccess }: { visible: boolean; tournament: any; onClose: () => void; onSuccess: () => void }) {
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const chipStyles = useMemo(() => makeChipStyles(theme), [theme]);
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState({ result_1st: '', result_2nd: '', result_3rd: '', result_4th: '' });

  const { data: quarterTeams } = useQuery({
    queryKey: ['quarter-teams', tournament?.id],
    queryFn: async () => {
      const res = await api.get(`/api/tournaments/${tournament?.id}/quarter-teams`);
      return res?.data ?? [];
    },
    enabled: !!tournament?.id,
  });

  const positions = [
    { key: 'result_1st' as const, label: '1° Lugar (12 pts)', emoji: '🥇' },
    { key: 'result_2nd' as const, label: '2° Lugar (8 pts)', emoji: '🥈' },
    { key: 'result_3rd' as const, label: '3° Lugar (4 pts)', emoji: '🥉' },
    { key: 'result_4th' as const, label: '4° Lugar (2 pts)', emoji: '4️⃣' },
  ];

  const selectedIds = [results.result_1st, results.result_2nd, results.result_3rd, results.result_4th].filter(Boolean);

  const handleResolve = async () => {
    if (!results.result_1st || !results.result_2nd || !results.result_3rd || !results.result_4th) {
      showToast('error', 'Selecciona los 4 resultados');
      return;
    }
    setLoading(true);
    try {
      const res = await api.post(`/api/final-bets/tournament/${tournament?.id}/resolve`, results);
      showToast('success', `Resuelta! ${res?.data?.winners_count ?? 0} ganadores, ${tournament?.currency ?? 'Bs'} ${Number(res?.data?.prize_per_winner ?? 0).toFixed(2)} c/u`);
      onSuccess();
    } catch (error: any) {
      showToast('error', error?.response?.data?.message || 'Error al resolver');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} onClose={onClose}>
      <Text style={{ ...theme.typography.h3, color: theme.colors.textPrimary, marginBottom: 4 }}>
        🏆 Resolver Polla Final
      </Text>
      <Text style={{ ...theme.typography.caption, color: theme.colors.textSecondary, marginBottom: 16 }}>
        {tournament?.name} • Ingresa los resultados reales
      </Text>

      {positions.map((pos) => (
        <View key={pos.key} style={{ marginBottom: 12 }}>
          <Text style={{ color: theme.colors.textSecondary, fontSize: 13, marginBottom: 6 }}>
            {pos.emoji} {pos.label}
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {(quarterTeams ?? []).map((team: any) => {
                const isSelected = results[pos.key] === team?.id;
                const isUsed = selectedIds.includes(team?.id) && !isSelected;
                return (
                  <Pressable
                    key={team?.id}
                    disabled={isUsed}
                    onPress={() => setResults({ ...results, [pos.key]: isSelected ? '' : team?.id })}
                    style={[
                      chipStyles.chip,
                      isSelected && chipStyles.chipSelected,
                      isUsed && chipStyles.chipDisabled,
                    ]}
                  >
                    <Text style={[
                      chipStyles.chipText,
                      isSelected && { color: '#FFF' },
                      isUsed && { color: theme.colors.textMuted },
                    ]}>
                      {team?.name}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>
        </View>
      ))}

      <Button title="Resolver Polla Final" variant="accent" size="lg" fullWidth onPress={handleResolve} loading={loading} style={{ marginTop: 8 }} />
    </Modal>
  );
}

function makeChipStyles(t: typeof staticTheme) {
  return StyleSheet.create({
    chip: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 8,
      backgroundColor: t.colors.surfaceElevated,
      borderWidth: 1,
      borderColor: t.colors.border,
    },
    chipSelected: {
      backgroundColor: t.colors.accent,
      borderColor: t.colors.accent,
    },
    chipDisabled: { opacity: 0.3 },
    chipText: { color: t.colors.textPrimary, fontSize: 13, fontFamily: 'Poppins_600SemiBold' },
  });
}

function makeStyles(t: typeof staticTheme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: t.colors.bg },
    headerGradient: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 22 },
    headerTitle: { fontSize: 20, fontFamily: 'Poppins_700Bold', color: '#fff', letterSpacing: -0.3 },
    headerSubtitle: { fontSize: 12, fontFamily: 'Poppins_400Regular', color: 'rgba(255,255,255,0.6)', marginTop: 4 },
    content: { padding: 20, paddingBottom: 80 },
    card: { marginBottom: 14 },
    cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
    cardTitle: { fontSize: 14, fontFamily: 'Poppins_700Bold', color: t.colors.textPrimary },
    cardInfo: { fontSize: 12, fontFamily: 'Poppins_400Regular', color: t.colors.textSecondary, marginTop: 2 },
    cardActions: { flexDirection: 'row', gap: 8 },
    actionBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 10,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: '#0052CC',
      gap: 6,
    },
    actionText: { fontFamily: 'Poppins_700Bold', fontSize: 13 },

    // ── Switch de visibilidad pública ────────────────────────────────────
    visibilityCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      padding: 14,
      borderRadius: 12,
      borderWidth: 1,
      marginBottom: 16,
    },
    visibilityIcon: {
      width: 40, height: 40, borderRadius: 12,
      alignItems: 'center', justifyContent: 'center',
    },
    visibilityTitle: {
      fontSize: 14,
      fontFamily: 'Poppins_700Bold',
      letterSpacing: -0.2,
    },
    visibilityHint: {
      fontSize: 11,
      fontFamily: 'Poppins_400Regular',
      marginTop: 2,
    },
  });
}
