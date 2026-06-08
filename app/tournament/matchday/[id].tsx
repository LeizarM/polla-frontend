import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  RefreshControl,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { safeGoBack } from '../../../utils/navigation';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useQuery } from '@tanstack/react-query';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Modal } from '../../../components/ui/Modal';
import { DateTimePicker } from '../../../components/ui/DateTimePicker';
import { Skeleton } from '../../../components/ui/Skeleton';
import { EmptyState } from '../../../components/ui/EmptyState';
import { TeamFlag } from '../../../components/ui/TeamFlag';
import { useToast } from '../../../components/ui/Toast';
import { useAuthStore } from '../../../store/authStore';
import { useTheme } from '../../../contexts/ThemeContext';
import { theme as staticTheme } from '../../../constants/theme';
import api from '../../../services/api';
import { downloadPdf } from '../../../services/downloadPdf';
import { parseBackendDate, toLocalDateString, boliviaWallToISO, boliviaParts } from '../../../utils/date';

export default function MatchdayManageScreen() {
  const { id = '' } = useLocalSearchParams<{ id: string }>();
  const { showToast } = useToast();
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const [refreshing, setRefreshing] = useState(false);
  const [showAddMatch, setShowAddMatch] = useState(false);
  const [showEditMatchday, setShowEditMatchday] = useState(false);
  const [resolving, setResolving] = useState(false);

  const { data: matchday, isLoading, refetch } = useQuery({
    queryKey: ['matchday', id],
    queryFn: async () => {
      const res = await api.get(`/api/matchdays/${id}`);
      return res?.data;
    },
    enabled: !!id,
  });

  const matches = matchday?.matches ?? [];
  const allHaveResults = matches.length > 0 && matches.every((m: any) => m?.result);
  const canResolve = allHaveResults && matchday?.status !== 'resolved';

  const handleResolve = async () => {
    setResolving(true);
    try {
      const res = await api.post(`/api/matchdays/${id}/resolve`);
      const data = res?.data;
      showToast('success', `¡Jornada resuelta! ${data?.winners_count ?? 0} ganadores, $${Number(data?.total_distributed ?? 0).toFixed(2)} distribuido`);
      refetch();
    } catch (error: any) {
      showToast('error', error?.response?.data?.message || error?.friendlyMessage || 'Error al resolver');
    } finally {
      setResolving(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
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
              <Text style={styles.headerTitle} numberOfLines={1}>{matchday?.name ?? 'Jornada'}</Text>
              <Text style={styles.headerSubtitle} numberOfLines={1}>
                {matchday?.tournament?.name} · Pozo: ${Number(matchday?.total_pool ?? 0).toFixed(2)}
              </Text>
            </View>

            {matchday?.status !== 'resolved' && (
              <Pressable style={styles.headerIconBtn} onPress={() => setShowEditMatchday(true)}>
                <Ionicons name="create-outline" size={18} color="rgba(255,255,255,0.75)" />
              </Pressable>
            )}
            <Pressable
              style={styles.reportBtn}
              onPress={() => router.push(`/tournament/matchday/report/${id}` as any)}
            >
              <Ionicons name="bar-chart" size={18} color="rgba(255,255,255,0.85)" />
            </Pressable>
            <Pressable
              style={styles.reportBtn}
              onPress={() => {
                downloadPdf(`/api/reports/matchday/${id}/pdf`, `reporte-jornada-${(id ?? '').slice(0, 8)}.pdf`)
                  .catch(() => showToast?.('error', 'Error al descargar PDF'));
              }}
            >
              <Ionicons name="document-text" size={18} color="rgba(255,255,255,0.75)" />
            </Pressable>
            <View style={[styles.statusBadge, {
              backgroundColor: matchday?.status === 'resolved' ? 'rgba(148,163,184,0.25)' : 'rgba(16,185,129,0.25)',
            }]}>
              <Text style={[styles.statusText, {
                color: matchday?.status === 'resolved' ? '#fff' : '#10B981',
              }]}>
                {matchday?.status === 'resolved' ? 'Resuelta' : 'Abierta'}
              </Text>
            </View>
          </View>
        </LinearGradient>
      </Animated.View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primaryLight} />
        }
      >
        {/* Matches */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Partidos ({matches.length})</Text>
          {matchday?.status !== 'resolved' && (
            <Button title="+ Partido" variant="ghost" size="sm" onPress={() => setShowAddMatch(true)} />
          )}
        </View>

        {isLoading ? (
          [1, 2, 3].map(i => <Skeleton key={i} width="100%" height={80} style={{ marginBottom: 8 }} />)
        ) : matches.length === 0 ? (
          <EmptyState icon="football-outline" title="No hay partidos" description="Agrega el primer partido" />
        ) : (
          matches.map((match: any) => (
            <MatchCard
              key={match?.id}
              match={match}
              allMatches={matches}
              onUpdate={refetch}
              isResolved={matchday?.status === 'resolved'}
              matchdayDate={matchday?.date}
            />
          ))
        )}

        {/* Resolve button */}
        {canResolve && (
          <Button
            title="🏆 Resolver Jornada"
            variant="accent"
            size="lg"
            fullWidth
            onPress={handleResolve}
            loading={resolving}
            style={{ marginTop: 20 }}
          />
        )}

        {/* Post-resolve actions */}
        {matchday?.status === 'resolved' && (
          <View style={{ gap: 12, marginTop: 20 }}>
            <Pressable
              onPress={() => router.push(`/tournament/matchday/winners/${id}` as any)}
              style={{
                flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                backgroundColor: 'rgba(245,158,11,0.15)', borderWidth: 1,
                borderColor: '#F59E0B', borderRadius: 12, paddingVertical: 14, gap: 8,
              }}
            >
              <Ionicons name="trophy" size={20} color="#F59E0B" />
              <Text style={{ color: '#F59E0B', fontFamily: 'Poppins_700Bold', fontSize: 15 }}>
                🏆 Ver Ganadores
              </Text>
            </Pressable>

            <Pressable
              onPress={() => router.push(`/tournament/matchday/report/${id}` as any)}
              style={{
                flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                backgroundColor: 'rgba(0,82,204,0.15)', borderWidth: 1,
                borderColor: '#0052CC', borderRadius: 12, paddingVertical: 14, gap: 8,
              }}
            >
              <Ionicons name="document-text" size={20} color="#0052CC" />
              <Text style={{ color: '#0052CC', fontFamily: 'Poppins_700Bold', fontSize: 15 }}>
                📋 Ver Reporte
              </Text>
            </Pressable>
          </View>
        )}
      </ScrollView>

      {/* Add match modal */}
      <AddMatchModal
        visible={showAddMatch}
        onClose={() => setShowAddMatch(false)}
        matchdayId={id}
        matchdayDate={matchday?.date ?? null}
        existingMatches={matches}
        onSuccess={() => {
          refetch();
          setShowAddMatch(false);
        }}
      />

      {/* Edit matchday modal */}
      <EditMatchdayModal
        visible={showEditMatchday}
        onClose={() => setShowEditMatchday(false)}
        matchday={matchday}
        onSuccess={() => {
          refetch();
          setShowEditMatchday(false);
        }}
      />
    </SafeAreaView>
  );
}

// ─── Edit Matchday Modal ──────────────────────────────────────────────────────

function EditMatchdayModal({ visible, onClose, matchday, onSuccess }: any) {
  const { showToast } = useToast();
  const { theme } = useTheme();
  const editStyles = useMemo(() => makeEditStyles(theme), [theme]);
  const [name, setName] = useState('');
  const [date, setDate] = useState<Date | null>(null);
  const [loading, setLoading] = useState(false);

  // Sync form with matchday data when modal opens.
  // Use parseBackendDate to avoid timezone off-by-one bug.
  useEffect(() => {
    if (visible && matchday) {
      setName(matchday.name ?? '');
      setDate(parseBackendDate(matchday.date));
    }
  }, [visible, matchday]);

  const handleSave = async () => {
    if (!name.trim()) {
      showToast('error', 'El nombre es requerido');
      return;
    }
    if (!date) {
      showToast('error', 'La fecha es requerida');
      return;
    }
    setLoading(true);
    try {
      // 1) Update the matchday itself
      await api.patch(`/api/matchdays/${matchday?.id}`, {
        name: name.trim(),
        // Send as YYYY-MM-DD using LOCAL calendar (no timezone shift).
        date: toLocalDateString(date),
      });

      // 2) Manually sync each match's match_date to the new day, preserving its
      //    existing time-of-day. We do this on the frontend because the backend
      //    sync is unreliable across timezones.
      const matchesToSync: any[] = matchday?.matches ?? [];
      const newDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      const syncResults = await Promise.allSettled(
        matchesToSync.map(async (m: any) => {
          // Preservar la HORA de Bolivia del partido y reubicarla en el nuevo día.
          const oldP = boliviaParts(m?.match_date);
          if (!oldP) return;
          const wall = new Date(
            newDay.getFullYear(), newDay.getMonth(), newDay.getDate(),
            Number(oldP.hh), Number(oldP.mm), 0, 0,
          );
          const newISO = boliviaWallToISO(wall);
          // Skip if already aligned (don't waste a request)
          if (m?.match_date && new Date(m.match_date).toISOString() === newISO) return;
          await api.patch(`/api/matches/${m.id}`, { match_date: newISO });
        }),
      );

      const synced = syncResults.filter(r => r.status === 'fulfilled').length;
      const failed = syncResults.filter(r => r.status === 'rejected').length;

      if (failed > 0) {
        showToast(
          'warning' as any,
          `Jornada actualizada. ${synced} partidos sincronizados, ${failed} fallaron.`,
        );
      } else if (matchesToSync.length > 0) {
        showToast('success', `✅ Jornada actualizada — ${synced} partido(s) sincronizados`);
      } else {
        showToast('success', '✅ Jornada actualizada');
      }
      onSuccess();
    } catch (error: any) {
      showToast('error', error?.response?.data?.message || error?.friendlyMessage || 'Error al actualizar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} onClose={onClose}>
      <Text style={editStyles.title}>✏️ Editar Jornada</Text>

      <Input
        label="Nombre"
        value={name}
        onChangeText={setName}
        placeholder="Ej: Jornada 1"
        icon="text-outline"
      />

      <DateTimePicker
        label="Fecha de la jornada"
        value={date}
        onChange={setDate}
        mode="date"
        minimumDate={new Date('2025-01-01')}
      />

      <Text style={editStyles.hint}>
        ⚡ Al cambiar la fecha, todos los partidos de esta jornada actualizarán su día automáticamente (conservando su hora).
      </Text>

      <View style={editStyles.actions}>
        <Button title="Cancelar" variant="outline" size="md" onPress={onClose} />
        <Button title="Guardar" variant="primary" size="md" onPress={handleSave} loading={loading} />
      </View>
    </Modal>
  );
}

// ─── Match Card ───────────────────────────────────────────────────────────────

function MatchCard({ match, allMatches, onUpdate, isResolved, matchdayDate }: {
  match: any;
  allMatches: any[];
  onUpdate: () => void;
  isResolved: boolean;
  matchdayDate?: string;
}) {
  const { showToast } = useToast();
  const { theme } = useTheme();
  const { isAdmin } = useAuthStore();
  const isAdminUser = isAdmin();
  const matchStyles = useMemo(() => makeMatchStyles(theme), [theme]);
  const [editing, setEditing] = useState(false);
  const [editingVersus, setEditingVersus] = useState(false);
  const [scoreA, setScoreA] = useState(String(match?.score_a ?? ''));
  const [scoreB, setScoreB] = useState(String(match?.score_b ?? ''));
  const [editingTime, setEditingTime] = useState(false);
  const [matchTime, setMatchTime] = useState<Date | null>(() => {
    try { return new Date(match?.match_date); } catch { return null; }
  });
  const [savingScore, setSavingScore] = useState(false);
  const [savingTime, setSavingTime] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleSaveScore = async () => {
    if (scoreA === '' || scoreB === '') {
      showToast('error', 'Ingresa ambos marcadores');
      return;
    }
    setSavingScore(true);
    try {
      await api.patch(`/api/matches/${match?.id}/scores`, {
        score_a: Number(scoreA),
        score_b: Number(scoreB),
      });
      showToast('success', 'Marcador guardado');
      setEditing(false);
      onUpdate();
    } catch (error: any) {
      showToast('error', error?.friendlyMessage || 'Error al guardar');
    } finally {
      setSavingScore(false);
    }
  };

  const handleSaveTime = async () => {
    if (!matchTime) {
      showToast('error', 'Selecciona una hora');
      return;
    }
    setSavingTime(true);
    try {
      // Build new match_date: use matchday date + selected time.
      // parseBackendDate handles timezone-safe parsing of date-only strings.
      const base = matchdayDate
        ? (parseBackendDate(matchdayDate) ?? new Date())
        : (parseBackendDate(match?.match_date) ?? new Date());
      const updated = new Date(base);
      updated.setHours(matchTime.getHours(), matchTime.getMinutes(), 0, 0);
      await api.patch(`/api/matches/${match?.id}`, {
        // Hora SIEMPRE como Bolivia (UTC-4), sin importar el TZ del device.
        match_date: boliviaWallToISO(updated),
      });
      showToast('success', 'Hora actualizada');
      setEditingTime(false);
      onUpdate();
    } catch (error: any) {
      showToast('error', error?.friendlyMessage || 'Error al actualizar hora');
    } finally {
      setSavingTime(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await api.delete(`/api/matches/${match?.id}`);
      showToast('success', 'Partido eliminado');
      setConfirmDelete(false);
      onUpdate();
    } catch (error: any) {
      const msg = error?.response?.data?.message || error?.friendlyMessage || 'Error al eliminar';
      showToast('error', msg);
      setConfirmDelete(false);
    } finally {
      setDeleting(false);
    }
  };

  const matchDateObj = match?.match_date ? new Date(match.match_date) : null;
  const isPastMatch  = matchDateObj && !isNaN(matchDateObj.getTime())
    ? matchDateObj.getTime() <= Date.now()
    : false;

  const displayTime = (() => {
    if (!matchDateObj || isNaN(matchDateObj.getTime())) return '';
    return `${String(matchDateObj.getHours()).padStart(2, '0')}:${String(matchDateObj.getMinutes()).padStart(2, '0')}`;
  })();

  const displayDate = (() => {
    if (!matchDateObj || isNaN(matchDateObj.getTime())) return '';
    const day = String(matchDateObj.getDate()).padStart(2, '0');
    const mo  = String(matchDateObj.getMonth() + 1).padStart(2, '0');
    return `${day}/${mo}/${matchDateObj.getFullYear()}`;
  })();

  return (
    <View style={[matchStyles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
      <LinearGradient
        colors={match?.result
          ? ['#10B98140', '#10B98120', 'transparent']
          : [theme.colors.primary, theme.colors.primaryLight, 'transparent']}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
        style={{ height: 1.5 }}
      />
      <View style={matchStyles.cardBody}>
      <View style={matchStyles.teams}>
        <View style={matchStyles.teamSide}>
          <TeamFlag team={match?.team_a} size={36} />
          <Text style={matchStyles.teamName} numberOfLines={1}>{match?.team_a?.name}</Text>
        </View>

        <View style={matchStyles.scoreSection}>
          {/* editing mode always takes priority — admin can re-edit any result */}
          {editing ? (
            <View style={matchStyles.scoreInputRow}>
              <TextInput
                style={matchStyles.scoreInput}
                value={scoreA}
                onChangeText={setScoreA}
                keyboardType="number-pad"
                maxLength={2}
                placeholder="0"
                placeholderTextColor={theme.colors.textMuted}
              />
              <Text style={matchStyles.scoreDash}>-</Text>
              <TextInput
                style={matchStyles.scoreInput}
                value={scoreB}
                onChangeText={setScoreB}
                keyboardType="number-pad"
                maxLength={2}
                placeholder="0"
                placeholderTextColor={theme.colors.textMuted}
              />
            </View>
          ) : match?.result ? (
            <View style={matchStyles.scoreBox}>
              <Text style={matchStyles.scoreText}>{match?.score_a} - {match?.score_b}</Text>
              <Text style={matchStyles.resultText}>
                {match?.result === 'L' ? 'Local' : match?.result === 'V' ? 'Visitante' : 'Empate'}
              </Text>
              {/* Admins can still re-schedule the match time even after a result is set */}
              {isAdminUser && (
                <Pressable
                  onPress={() => setEditingTime(true)}
                  style={matchStyles.scoreTimeEdit}
                >
                  <Ionicons name="time-outline" size={11} color={theme.colors.primaryLight} />
                  <Text style={[matchStyles.scoreTimeEditText, { color: theme.colors.primaryLight }]}>
                    {displayTime || '—:——'}
                    {displayDate ? ` · ${displayDate}` : ''}
                  </Text>
                </Pressable>
              )}
            </View>
          ) : (
            <View style={matchStyles.vsBox}>
              <Text style={matchStyles.vsText}>VS</Text>
              <Pressable onPress={() => isAdminUser && setEditingTime(true)}>
                <Text style={[matchStyles.timeText, isAdminUser && { color: theme.colors.primaryLight }]}>
                  {displayTime || '—:——'}
                </Text>
                {displayDate && (
                  <Text style={[matchStyles.dateText, isPastMatch && { color: '#EF4444' }]}>
                    {displayDate}{isPastMatch ? '  ⚠️' : ''}
                  </Text>
                )}
              </Pressable>
            </View>
          )}
        </View>

        <View style={matchStyles.teamSide}>
          <TeamFlag team={match?.team_b} size={36} />
          <Text style={matchStyles.teamName} numberOfLines={1}>{match?.team_b?.name}</Text>
        </View>
      </View>

      {/* Time editing inline — admins can reschedule any match, even resolved ones */}
      {isAdminUser && editingTime && (
        <View style={matchStyles.timeEditRow}>
          <DateTimePicker
            label="Hora del partido"
            value={matchTime}
            onChange={setMatchTime}
            mode="time"
          />
          <View style={matchStyles.timeEditActions}>
            <Button title="Cancelar" variant="outline" size="sm" onPress={() => setEditingTime(false)} />
            <Button title="Guardar hora" variant="primary" size="sm" onPress={handleSaveTime} loading={savingTime} />
          </View>
        </View>
      )}

      {/* Confirm delete banner — admin only */}
      {isAdminUser && !isResolved && !match?.result && confirmDelete && (
        <View style={matchStyles.confirmDeleteRow}>
          <Ionicons name="warning-outline" size={16} color="#EF4444" />
          <Text style={matchStyles.confirmDeleteText}>¿Eliminar este partido?</Text>
          <Button title="Cancelar" variant="outline" size="sm" onPress={() => setConfirmDelete(false)} />
          <Button
            title="Eliminar"
            variant="ghost"
            size="sm"
            loading={deleting}
            onPress={handleDelete}
            style={{ backgroundColor: 'rgba(239,68,68,0.15)', borderColor: '#EF4444', borderWidth: 1 }}
          />
        </View>
      )}

      {/* Score / versus / delete actions — ADMIN ONLY */}
      {isAdminUser && !isResolved && !editingTime && !confirmDelete && (
        <View style={matchStyles.actions}>
          {editing ? (
            <>
              <Button title="Cancelar" variant="outline" size="sm" onPress={() => setEditing(false)} />
              <Button
                title="Guardar resultado"
                variant="primary"
                size="sm"
                onPress={handleSaveScore}
                loading={savingScore}
              />
            </>
          ) : (
            <>
              {/* Delete & Versus only available before result */}
              {!match?.result && (
                <Pressable style={matchStyles.deleteIconBtn} onPress={() => setConfirmDelete(true)}>
                  <Ionicons name="trash-outline" size={16} color="#EF4444" />
                </Pressable>
              )}
              {!match?.result && (
                <Button title="✏️ Versus" variant="ghost" size="sm" onPress={() => setEditingVersus(true)} />
              )}
              {/* Resultado/Editar — always visible for admin */}
              <Button
                title={match?.result ? '✏️ Editar resultado' : '📝 Ingresar resultado'}
                variant={match?.result ? 'ghost' : 'accent'}
                size="sm"
                onPress={() => {
                  setScoreA(String(match?.score_a ?? ''));
                  setScoreB(String(match?.score_b ?? ''));
                  setEditing(true);
                }}
              />
            </>
          )}
        </View>
      )}

      {/* Edit versus modal */}
      <EditMatchModal
        visible={editingVersus}
        onClose={() => setEditingVersus(false)}
        match={match}
        allMatches={allMatches}
        onSuccess={() => { setEditingVersus(false); onUpdate(); }}
      />
      </View>
    </View>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Returns true if selecting `candidateId` paired with `anchorId` would duplicate an existing matchup */
function wouldDuplicate(
  candidateId: string,
  anchorId: string,
  existingMatches: any[],
  excludeMatchId?: string,
): boolean {
  if (!anchorId || !candidateId) return false;
  return existingMatches.some((m: any) => {
    if (excludeMatchId && m?.id === excludeMatchId) return false;
    return (
      (m?.team_a_id === anchorId && m?.team_b_id === candidateId) ||
      (m?.team_a_id === candidateId && m?.team_b_id === anchorId) ||
      (m?.team_a?.id === anchorId && m?.team_b?.id === candidateId) ||
      (m?.team_a?.id === candidateId && m?.team_b?.id === anchorId)
    );
  });
}

// ─── Team Picker Sheet ────────────────────────────────────────────────────────

function TeamPickerSheet({
  teams,
  selectedId,
  anchorId,          // the OTHER team already chosen (used for duplicate detection)
  onSelect,
  label,
  existingMatches,
  excludeMatchId,
}: {
  teams: any[];
  selectedId: string;
  anchorId: string;
  onSelect: (id: string) => void;
  label: string;
  existingMatches: any[];
  excludeMatchId?: string;
}) {
  const [search, setSearch] = useState('');
  const { theme } = useTheme();
  const pickerStyles = useMemo(() => makePickerStyles(theme), [theme]);
  const addMatchStyles = useMemo(() => makeAddMatchStyles(theme), [theme]);

  const filtered = teams.filter(
    (t: any) =>
      t?.id !== anchorId &&
      (t?.name?.toLowerCase().includes(search.toLowerCase()) ||
        t?.country?.toLowerCase().includes(search.toLowerCase())),
  );

  return (
    <View style={pickerStyles.container}>
      <Text style={addMatchStyles.label}>{label}</Text>

      {/* Search */}
      <View style={pickerStyles.searchRow}>
        <Ionicons name="search" size={16} color={theme.colors.textMuted} style={{ marginRight: 8 }} />
        <TextInput
          style={pickerStyles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Buscar equipo..."
          placeholderTextColor={theme.colors.textMuted}
        />
        {search.length > 0 && (
          <Pressable onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={16} color={theme.colors.textMuted} />
          </Pressable>
        )}
      </View>

      {/* Team list */}
      <ScrollView style={pickerStyles.list} showsVerticalScrollIndicator={false} nestedScrollEnabled>
        {filtered.length === 0 ? (
          <Text style={pickerStyles.emptyText}>Sin resultados</Text>
        ) : (
          filtered.map((t: any) => {
            const isSelected = selectedId === t?.id;
            const isDup = anchorId
              ? wouldDuplicate(t?.id, anchorId, existingMatches, excludeMatchId)
              : false;

            return (
              <Pressable
                key={t?.id}
                style={[
                  pickerStyles.row,
                  isSelected && pickerStyles.rowSelected,
                  isDup && pickerStyles.rowDuplicate,
                ]}
                onPress={() => !isDup && onSelect(t?.id)}
              >
                <TeamFlag team={t} size={32} />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={[
                    pickerStyles.teamName,
                    isSelected && pickerStyles.teamNameSelected,
                    isDup && pickerStyles.teamNameDup,
                  ]}>
                    {t?.name}
                  </Text>
                  <Text style={pickerStyles.teamCountry}>{t?.country}</Text>
                </View>
                {isSelected && !isDup && (
                  <Ionicons name="checkmark-circle" size={20} color={theme.colors.primaryLight} />
                )}
                {isDup && (
                  <View style={pickerStyles.dupBadge}>
                    <Text style={pickerStyles.dupBadgeText}>Ya existe</Text>
                  </View>
                )}
              </Pressable>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

// ─── Edit Match Modal (change versus) ────────────────────────────────────────

function EditMatchModal({ visible, onClose, match, allMatches, onSuccess }: any) {
  const { showToast } = useToast();
  const { theme } = useTheme();
  const addMatchStyles = useMemo(() => makeAddMatchStyles(theme), [theme]);
  const [teamAId, setTeamAId] = useState('');
  const [teamBId, setTeamBId] = useState('');
  const [step, setStep] = useState<'local' | 'visitante'>('local');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible && match) {
      setTeamAId(match?.team_a_id ?? match?.team_a?.id ?? '');
      setTeamBId(match?.team_b_id ?? match?.team_b?.id ?? '');
      setStep('local');
    }
  }, [visible, match]);

  const { data: allTeams = [], isLoading: teamsLoading } = useQuery({
    queryKey: ['all-teams'],
    queryFn: async () => { const res = await api.get('/api/teams'); return res?.data ?? []; },
    staleTime: 5 * 60 * 1000,
  });

  const teamA = allTeams.find((t: any) => t?.id === teamAId);
  const teamB = allTeams.find((t: any) => t?.id === teamBId);
  const otherMatches = (allMatches ?? []).filter((m: any) => m?.id !== match?.id);
  const steps: Array<'local' | 'visitante'> = ['local', 'visitante'];
  const stepLabels = ['Local', 'Visitante'];
  const currentStepIdx = steps.indexOf(step);

  const handleSave = async () => {
    if (!teamAId || !teamBId) { showToast('error', 'Selecciona ambos equipos'); return; }
    if (teamAId === teamBId) { showToast('error', 'Los equipos deben ser diferentes'); return; }
    setLoading(true);
    try {
      await api.patch(`/api/matches/${match?.id}`, { team_a_id: teamAId, team_b_id: teamBId });
      showToast('success', '✅ Versus actualizado');
      onSuccess();
    } catch (error: any) {
      showToast('error', error?.response?.data?.message || error?.friendlyMessage || 'Error al actualizar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} onClose={onClose}>
      <View style={addMatchStyles.titleRow}>
        <Text style={addMatchStyles.title}>✏️ Editar Versus</Text>
      </View>

      <View style={addMatchStyles.stepper}>
        {steps.map((s, i) => (
          <React.Fragment key={s}>
            <Pressable
              style={[addMatchStyles.stepDot, i < currentStepIdx && addMatchStyles.stepDone, i === currentStepIdx && addMatchStyles.stepActive]}
              onPress={() => { if (i === 0) setStep('local'); if (i === 1 && teamAId) setStep('visitante'); }}
            >
              {i < currentStepIdx ? <Ionicons name="checkmark" size={12} color="#fff" /> : <Text style={addMatchStyles.stepDotText}>{i + 1}</Text>}
            </Pressable>
            <Text style={[addMatchStyles.stepLabel, i === currentStepIdx && { color: theme.colors.primaryLight }]}>{stepLabels[i]}</Text>
            {i < steps.length - 1 && <View style={[addMatchStyles.stepLine, i < currentStepIdx && { backgroundColor: theme.colors.primaryLight }]} />}
          </React.Fragment>
        ))}
      </View>

      {teamA && teamB && (
        <View style={addMatchStyles.vsPreview}>
          <View style={addMatchStyles.vsTeam}><TeamFlag team={teamA} size={36} /><Text style={addMatchStyles.vsTeamName} numberOfLines={1}>{teamA.name}</Text></View>
          <Text style={addMatchStyles.vsText}>VS</Text>
          <View style={addMatchStyles.vsTeam}><TeamFlag team={teamB} size={36} /><Text style={addMatchStyles.vsTeamName} numberOfLines={1}>{teamB.name}</Text></View>
        </View>
      )}

      {teamsLoading ? (
        <View style={{ padding: 24, alignItems: 'center' }}><Text style={{ color: theme.colors.textSecondary }}>Cargando equipos...</Text></View>
      ) : (
        <>
          {step === 'local' && (
            <TeamPickerSheet teams={allTeams} selectedId={teamAId} anchorId={teamBId}
              onSelect={(id) => { setTeamAId(id); setStep('visitante'); }}
              label="🏠 Equipo Local" existingMatches={otherMatches} excludeMatchId={match?.id} />
          )}
          {step === 'visitante' && (
            <TeamPickerSheet teams={allTeams} selectedId={teamBId} anchorId={teamAId}
              onSelect={(id) => setTeamBId(id)}
              label="✈️ Equipo Visitante" existingMatches={otherMatches} excludeMatchId={match?.id} />
          )}
        </>
      )}

      <View style={addMatchStyles.actions}>
        {currentStepIdx > 0
          ? <Button title="← Atrás" variant="outline" size="md" onPress={() => setStep('local')} />
          : <Button title="Cancelar" variant="outline" size="md" onPress={onClose} />}
        {step === 'local'
          ? <Button title="Siguiente →" variant="primary" size="md" disabled={!teamAId} onPress={() => setStep('visitante')} />
          : <Button title="Guardar Versus" variant="primary" size="md" onPress={handleSave} loading={loading} disabled={!teamAId || !teamBId} />}
      </View>
    </Modal>
  );
}

function AddMatchModal({ visible, onClose, matchdayId, matchdayDate, existingMatches = [], onSuccess }: any) {
  const { showToast } = useToast();
  const { theme } = useTheme();
  const addMatchStyles = useMemo(() => makeAddMatchStyles(theme), [theme]);
  const [teamAId, setTeamAId] = useState('');
  const [teamBId, setTeamBId] = useState('');
  const [matchTime, setMatchTime] = useState<Date | null>(null);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'local' | 'visitante' | 'hora'>('local');

  // Reset form when modal closes
  useEffect(() => {
    if (!visible) {
      setTeamAId('');
      setTeamBId('');
      setMatchTime(null);
      setStep('local');
    }
  }, [visible]);

  // Fetch ALL teams from the system (not filtered by tournament)
  const { data: allTeams = [], isLoading: teamsLoading } = useQuery({
    queryKey: ['all-teams'],
    queryFn: async () => {
      const res = await api.get('/api/teams');
      return res?.data ?? [];
    },
    staleTime: 5 * 60 * 1000,
  });

  const teamA = allTeams.find((t: any) => t?.id === teamAId);
  const teamB = allTeams.find((t: any) => t?.id === teamBId);

  const matchdayDateDisplay = (() => {
    const d = parseBackendDate(matchdayDate);
    if (!d) return '';
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  })();

  const handleCreate = async () => {
    if (!teamAId || !teamBId) { showToast('error', 'Selecciona ambos equipos'); return; }
    if (teamAId === teamBId) { showToast('error', 'Los equipos deben ser diferentes'); return; }
    if (!matchTime) { showToast('error', 'Selecciona la hora del partido'); return; }

    // Timezone-safe: parseBackendDate handles date-only strings as local midnight.
    const base = (matchdayDate && parseBackendDate(matchdayDate)) ?? new Date();
    const combined = new Date(base);
    combined.setHours(matchTime.getHours(), matchTime.getMinutes(), 0, 0);

    setLoading(true);
    try {
      await api.post('/api/matches', {
        matchday_id: matchdayId,
        team_a_id: teamAId,
        team_b_id: teamBId,
        // Hora SIEMPRE interpretada como Bolivia (UTC-4), sin importar el TZ del device.
        match_date: boliviaWallToISO(combined),
      });
      showToast('success', '✅ Partido creado');
      onSuccess();
    } catch (error: any) {
      showToast('error', error?.friendlyMessage || 'Error al crear partido');
    } finally {
      setLoading(false);
    }
  };

  const steps: Array<'local' | 'visitante' | 'hora'> = ['local', 'visitante', 'hora'];
  const stepLabels = ['Local', 'Visitante', 'Hora'];
  const currentStepIdx = steps.indexOf(step);

  return (
    <Modal visible={visible} onClose={onClose}>
      {/* Title + date badge */}
      <View style={addMatchStyles.titleRow}>
        <Text style={addMatchStyles.title}>⚽ Nuevo Partido</Text>
        {matchdayDateDisplay ? (
          <View style={addMatchStyles.dateBadge}>
            <Ionicons name="calendar-outline" size={12} color={theme.colors.primaryLight} />
            <Text style={addMatchStyles.dateBadgeText}>{matchdayDateDisplay}</Text>
          </View>
        ) : null}
      </View>
      {matchdayDateDisplay ? (
        <Text style={addMatchStyles.inheritedHint}>
          ⓘ El partido hereda la fecha de la jornada · sólo configurarás la hora
        </Text>
      ) : null}

      {/* Step indicator */}
      <View style={addMatchStyles.stepper}>
        {steps.map((s, i) => (
          <React.Fragment key={s}>
            <Pressable
              style={[
                addMatchStyles.stepDot,
                i < currentStepIdx && addMatchStyles.stepDone,
                i === currentStepIdx && addMatchStyles.stepActive,
              ]}
              onPress={() => {
                if (i < currentStepIdx) setStep(s);
                if (i === 1 && teamAId) setStep(s);
                if (i === 2 && teamAId && teamBId) setStep(s);
              }}
            >
              {i < currentStepIdx ? (
                <Ionicons name="checkmark" size={12} color="#fff" />
              ) : (
                <Text style={addMatchStyles.stepDotText}>{i + 1}</Text>
              )}
            </Pressable>
            <Text style={[addMatchStyles.stepLabel, i === currentStepIdx && { color: theme.colors.primaryLight }]}>
              {stepLabels[i]}
            </Text>
            {i < steps.length - 1 && (
              <View style={[addMatchStyles.stepLine, i < currentStepIdx && { backgroundColor: theme.colors.primaryLight }]} />
            )}
          </React.Fragment>
        ))}
      </View>

      {/* VS preview (shows once both teams selected) */}
      {teamA && teamB && (
        <View style={addMatchStyles.vsPreview}>
          <View style={addMatchStyles.vsTeam}>
            <TeamFlag team={teamA} size={36} />
            <Text style={addMatchStyles.vsTeamName} numberOfLines={1}>{teamA.name}</Text>
          </View>
          <Text style={addMatchStyles.vsText}>VS</Text>
          <View style={addMatchStyles.vsTeam}>
            <TeamFlag team={teamB} size={36} />
            <Text style={addMatchStyles.vsTeamName} numberOfLines={1}>{teamB.name}</Text>
          </View>
        </View>
      )}

      {/* Step content */}
      {teamsLoading ? (
        <View style={{ padding: 24, alignItems: 'center' }}>
          <Text style={{ color: theme.colors.textSecondary }}>Cargando equipos...</Text>
        </View>
      ) : allTeams.length === 0 ? (
        <View style={addMatchStyles.noTeamsBox}>
          <Ionicons name="alert-circle-outline" size={32} color={theme.colors.textMuted} />
          <Text style={addMatchStyles.noTeamsTitle}>Sin equipos</Text>
          <Text style={addMatchStyles.noTeamsText}>
            Crea equipos en el panel de administración antes de agregar partidos.
          </Text>
        </View>
      ) : (
        <>
          {step === 'local' && (
            <TeamPickerSheet
              teams={allTeams}
              selectedId={teamAId}
              anchorId={teamBId}
              onSelect={(id) => { setTeamAId(id); setStep('visitante'); }}
              label="🏠 Equipo Local"
              existingMatches={existingMatches}
            />
          )}
          {step === 'visitante' && (
            <TeamPickerSheet
              teams={allTeams}
              selectedId={teamBId}
              anchorId={teamAId}
              onSelect={(id) => { setTeamBId(id); setStep('hora'); }}
              label="✈️ Equipo Visitante"
              existingMatches={existingMatches}
            />
          )}
          {step === 'hora' && (
            <View style={{ paddingTop: 8 }}>
              <DateTimePicker
                label="Hora del partido"
                value={matchTime}
                onChange={setMatchTime}
                mode="time"
              />
            </View>
          )}
        </>
      )}

      {/* Navigation buttons */}
      <View style={addMatchStyles.actions}>
        {currentStepIdx > 0 ? (
          <Button
            title="← Atrás"
            variant="outline"
            size="md"
            onPress={() => setStep(steps[currentStepIdx - 1])}
          />
        ) : (
          <Button title="Cancelar" variant="outline" size="md" onPress={onClose} />
        )}

        {step !== 'hora' ? (
          <Button
            title="Siguiente →"
            variant="primary"
            size="md"
            disabled={step === 'local' ? !teamAId : !teamBId}
            onPress={() => setStep(steps[currentStepIdx + 1])}
          />
        ) : (
          <Button
            title="Crear Partido"
            variant="primary"
            size="md"
            onPress={handleCreate}
            loading={loading}
            disabled={!teamAId || !teamBId || !matchTime}
          />
        )}
      </View>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

function makeEditStyles(t: typeof staticTheme) {
  return StyleSheet.create({
    title: { fontSize: 20, fontFamily: 'Poppins_700Bold', color: t.colors.textPrimary, marginBottom: 20, textAlign: 'center' },
    hint: {
      fontSize: 12, fontFamily: 'Poppins_400Regular',
      color: t.colors.textSecondary,
      backgroundColor: 'rgba(0,82,204,0.1)',
      borderWidth: 1, borderColor: 'rgba(0,82,204,0.2)',
      borderRadius: 8, padding: 8, marginBottom: 16, lineHeight: 18,
    },
    actions: { flexDirection: 'row', gap: 12, marginTop: 8, justifyContent: 'flex-end' },
  });
}

function makeAddMatchStyles(t: typeof staticTheme) {
  return StyleSheet.create({
    titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
    title: { fontSize: 20, fontFamily: 'Poppins_700Bold', color: t.colors.textPrimary },
    dateBadge: {
      flexDirection: 'row', alignItems: 'center', gap: 4,
      backgroundColor: 'rgba(0,82,204,0.12)', borderWidth: 1, borderColor: 'rgba(0,82,204,0.25)',
      borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4,
    },
    dateBadgeText: { fontSize: 12, fontFamily: 'Poppins_600SemiBold', color: t.colors.primaryLight },
    inheritedHint: {
      fontSize: 11,
      fontFamily: 'Poppins_400Regular',
      color: t.colors.textMuted,
      marginBottom: 12,
      paddingHorizontal: 4,
      lineHeight: 16,
    },
    label: { fontSize: 13, fontFamily: 'Poppins_500Medium', color: t.colors.textSecondary, marginBottom: 4 },
    stepper: {
      flexDirection: 'row', alignItems: 'center',
      marginBottom: 14, paddingHorizontal: 4,
    },
    stepDot: {
      width: 24, height: 24, borderRadius: 12,
      backgroundColor: t.colors.surface,
      borderWidth: 1.5, borderColor: t.colors.border,
      alignItems: 'center', justifyContent: 'center',
    },
    stepActive: { borderColor: t.colors.primaryLight, backgroundColor: 'rgba(0,82,204,0.2)' },
    stepDone: { backgroundColor: t.colors.primaryLight, borderColor: t.colors.primaryLight },
    stepDotText: { fontSize: 11, fontFamily: 'Poppins_700Bold', color: t.colors.textMuted },
    stepLabel: { fontSize: 12, fontFamily: 'Poppins_400Regular', color: t.colors.textMuted, marginHorizontal: 4 },
    stepLine: { flex: 1, height: 1.5, backgroundColor: t.colors.border, marginHorizontal: 2 },
    vsPreview: {
      flexDirection: 'row', alignItems: 'center',
      backgroundColor: 'rgba(0,82,204,0.08)', borderRadius: 12,
      borderWidth: 1, borderColor: 'rgba(0,82,204,0.2)',
      padding: 12, marginBottom: 12, gap: 8,
    },
    vsTeam: { flex: 1, alignItems: 'center', gap: 4 },
    vsTeamName: { fontSize: 12, fontFamily: 'Poppins_600SemiBold', color: t.colors.textPrimary, textAlign: 'center' },
    vsText: { fontSize: 17, fontFamily: 'Poppins_700Bold', color: t.colors.textMuted, minWidth: 32, textAlign: 'center' },
    noTeamsBox: { alignItems: 'center', padding: 24, gap: 8 },
    noTeamsTitle: { fontSize: 17, fontFamily: 'Poppins_700Bold', color: t.colors.textSecondary },
    noTeamsText: { fontSize: 12, fontFamily: 'Poppins_400Regular', color: t.colors.textMuted, textAlign: 'center', lineHeight: 18 },
    actions: { flexDirection: 'row', gap: 12, marginTop: 20, justifyContent: 'space-between' },
  });
}

function makePickerStyles(t: typeof staticTheme) {
  return StyleSheet.create({
    container: { flex: 1 },
    searchRow: {
      flexDirection: 'row', alignItems: 'center',
      backgroundColor: t.colors.inputBg,
      borderRadius: 12, borderWidth: 1, borderColor: t.colors.border,
      paddingHorizontal: 12, height: 44, marginBottom: 8,
    },
    searchInput: {
      flex: 1, color: t.colors.textPrimary,
      fontSize: 14, fontFamily: 'Poppins_400Regular',
    },
    list: { maxHeight: 240 },
    row: {
      flexDirection: 'row', alignItems: 'center',
      paddingHorizontal: 8, paddingVertical: 10,
      borderRadius: 12, marginBottom: 4,
      borderWidth: 1, borderColor: 'transparent',
    },
    rowSelected: {
      backgroundColor: 'rgba(0,82,204,0.12)', borderColor: 'rgba(0,82,204,0.35)',
    },
    teamName: { fontSize: 14, fontFamily: 'Poppins_600SemiBold', color: t.colors.textPrimary },
    teamNameSelected: { color: t.colors.primaryLight },
    teamNameDup: { color: t.colors.textMuted },
    teamCountry: { fontSize: 12, fontFamily: 'Poppins_400Regular', color: t.colors.textMuted },
    emptyText: { fontSize: 14, fontFamily: 'Poppins_400Regular', color: t.colors.textMuted, textAlign: 'center', padding: 20 },
    rowDuplicate: { opacity: 0.45 },
    dupBadge: {
      backgroundColor: 'rgba(245,158,11,0.15)',
      borderWidth: 1, borderColor: 'rgba(245,158,11,0.4)',
      borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2,
    },
    dupBadgeText: { fontSize: 10, fontFamily: 'Poppins_700Bold', color: '#F59E0B' },
  });
}

function makeMatchStyles(t: typeof staticTheme) {
  return StyleSheet.create({
    card: {
      borderRadius: 14, borderWidth: 1, overflow: 'hidden',
      marginBottom: 8,
      shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.12, shadowRadius: 6, elevation: 3,
    },
    cardBody: { padding: 14 },
    teams: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    teamSide: { flex: 1, alignItems: 'center' },
    teamName: { fontSize: 12, fontFamily: 'Poppins_600SemiBold', color: t.colors.textPrimary, textAlign: 'center', marginTop: 4 },
    scoreSection: { width: 100, alignItems: 'center', justifyContent: 'center' },
    scoreBox: { alignItems: 'center' },
    scoreText: { fontSize: 20, fontFamily: 'Poppins_800ExtraBold', color: t.colors.textPrimary },
    resultText: { fontSize: 11, fontFamily: 'Poppins_400Regular', color: t.colors.textSecondary },
    scoreTimeEdit: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      marginTop: 6,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 6,
      backgroundColor: t.colors.primaryLight + '14',
      borderWidth: 1,
      borderColor: t.colors.primaryLight + '40',
    },
    scoreTimeEditText: {
      fontSize: 10,
      fontFamily: 'Poppins_600SemiBold',
    },
    vsBox: { alignItems: 'center' },
    vsText: { fontSize: 17, fontFamily: 'Poppins_700Bold', color: t.colors.textMuted },
    timeText: { fontSize: 12, fontFamily: 'Poppins_400Regular', color: t.colors.textSecondary, marginTop: 2, textAlign: 'center' as const },
    dateText: { fontSize: 10, fontFamily: 'Poppins_500Medium', color: t.colors.textMuted, marginTop: 1, textAlign: 'center' as const },
    scoreInputRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    scoreInput: {
      width: 36, height: 36, borderRadius: 8, backgroundColor: t.colors.surface,
      borderWidth: 1, borderColor: t.colors.border, textAlign: 'center',
      color: t.colors.textPrimary, fontSize: 18, fontFamily: 'Poppins_700Bold',
    },
    scoreDash: { color: t.colors.textMuted, fontSize: 18, fontFamily: 'Poppins_700Bold' },
    actions: {
      flexDirection: 'row', justifyContent: 'center', gap: 8,
      marginTop: 8, borderTopWidth: 1, borderTopColor: t.colors.border, paddingTop: 8,
    },
    timeEditRow: {
      marginTop: 8, borderTopWidth: 1, borderTopColor: t.colors.border, paddingTop: 8,
    },
    timeEditActions: {
      flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: -4,
    },
    confirmDeleteRow: {
      flexDirection: 'row', alignItems: 'center', gap: 8,
      marginTop: 8, borderTopWidth: 1, borderTopColor: 'rgba(239,68,68,0.3)',
      paddingTop: 8, flexWrap: 'wrap',
    },
    confirmDeleteText: {
      fontSize: 12, fontFamily: 'Poppins_600SemiBold', color: '#EF4444', flex: 1,
    },
    deleteIconBtn: {
      width: 30, height: 30, borderRadius: 8,
      backgroundColor: 'rgba(239,68,68,0.1)',
      alignItems: 'center', justifyContent: 'center',
      borderWidth: 1, borderColor: 'rgba(239,68,68,0.25)',
    },
  });
}

function makeStyles(t: typeof staticTheme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: t.colors.bg },
    headerGrad: { paddingBottom: 22 },
    headerRow: {
      flexDirection: 'row', alignItems: 'center',
      paddingHorizontal: 16, paddingTop: 14, gap: 8,
    },
    backBtn: {
      width: 40, height: 40, borderRadius: 12,
      backgroundColor: 'rgba(255,255,255,0.10)',
      borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
      alignItems: 'center', justifyContent: 'center',
    },
    headerTitle: { fontSize: 18, fontFamily: 'Poppins_700Bold', color: '#fff', letterSpacing: -0.3 },
    headerSubtitle: { fontSize: 11, fontFamily: 'Poppins_400Regular', color: 'rgba(255,255,255,0.6)', marginTop: 1 },
    headerIconBtn: {
      width: 34, height: 34, borderRadius: 10,
      backgroundColor: 'rgba(255,255,255,0.08)',
      borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)',
      alignItems: 'center', justifyContent: 'center',
    },
    reportBtn: {
      width: 34, height: 34, borderRadius: 10,
      backgroundColor: 'rgba(255,255,255,0.08)',
      borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)',
      alignItems: 'center' as const, justifyContent: 'center' as const,
    },
    statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
    statusText: { fontSize: 11, fontFamily: 'Poppins_600SemiBold' },
    content: { flex: 1 },
    scrollContent: { padding: 20, paddingBottom: 80 },
    sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
    sectionTitle: { fontSize: 17, fontFamily: 'Poppins_700Bold', color: t.colors.textPrimary },
  });
}
