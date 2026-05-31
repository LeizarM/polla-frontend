/**
 * Partidos — Premium match results screen
 * Gradient header · stagger cards with gradient top line · Poppins typography
 */
import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, SectionList, ScrollView, Modal,
  RefreshControl, Pressable, TextInput, Platform,
} from 'react-native';
import { SafeAreaView }   from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons }       from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { router }         from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import * as Haptics       from 'expo-haptics';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { Badge }      from '../../components/ui/Badge';
import { Button }     from '../../components/ui/Button';
import { Skeleton }   from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import { TeamFlag }   from '../../components/ui/TeamFlag';
import { useToast }   from '../../components/ui/Toast';
import { useTheme }   from '../../contexts/ThemeContext';
import api from '../../services/api';

interface MatchItem {
  id: string; match_date: string; status: string;
  score_a?: number | null; score_b?: number | null; result?: string | null;
  matchday_id: string;
  matchday?: { id: string; name: string };
  team_a: { id: string; name: string; country: string };
  team_b: { id: string; name: string; country: string };
}

type FilterType = 'all' | 'scheduled' | 'finished';

function formatMatchDate(dateStr: string): string {
  try {
    const d   = new Date(dateStr);
    const day = String(d.getDate()).padStart(2, '0');
    const mo  = String(d.getMonth() + 1).padStart(2, '0');
    const hh  = String(d.getHours()).padStart(2, '0');
    const mm  = String(d.getMinutes()).padStart(2, '0');
    return `${day}/${mo}/${d.getFullYear()}  ${hh}:${mm}`;
  } catch { return dateStr ?? ''; }
}

function formatSectionDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    const MONTHS = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
    return `${String(d.getDate()).padStart(2,'0')} ${MONTHS[d.getMonth()]}`;
  } catch { return ''; }
}

export default function PartidosScreen() {
  const { theme }     = useTheme();
  const { showToast } = useToast();
  const queryClient   = useQueryClient();
  const [filter,          setFilter]          = useState<FilterType>('all');
  const [editingMatchId,  setEditingMatchId]  = useState<string | null>(null);
  const [scoreA,          setScoreA]          = useState('');
  const [scoreB,          setScoreB]          = useState('');
  const [refreshing,         setRefreshing]         = useState(false);
  const [selectedMatchdayId, setSelectedMatchdayId] = useState<string | null>(null);
  const [showPicker,         setShowPicker]         = useState(false);
  const [pickerSearch,       setPickerSearch]       = useState('');

  const { data: matches, isLoading, refetch } = useQuery({
    queryKey: ['admin-all-matches'],
    queryFn: async () => {
      try { const res = await api.get('/api/matches'); return (res?.data ?? []) as MatchItem[]; }
      catch { return [] as MatchItem[]; }
    },
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  // Refetch automático al volver a la pantalla
  useFocusEffect(useCallback(() => { refetch(); }, []));

  const filtered = useMemo(() => (matches ?? []).filter((m: MatchItem) => {
    if (filter === 'scheduled') return m?.status === 'scheduled';
    if (filter === 'finished')  return m?.status === 'finished';
    return true;
  }), [matches, filter]);

  // All jornadas for the picker (regardless of status filter)
  const allJornadas = useMemo(() => {
    const map = new Map<string, { id: string; name: string; minDate: string; maxDate: string }>();
    for (const m of matches ?? []) {
      const key = m?.matchday_id ?? 'unknown';
      if (!map.has(key)) {
        map.set(key, { id: m?.matchday_id, name: m?.matchday?.name ?? 'Jornada', minDate: m?.match_date ?? '', maxDate: m?.match_date ?? '' });
      }
      const grp = map.get(key)!;
      if ((m?.match_date ?? '') < grp.minDate) grp.minDate = m.match_date ?? '';
      if ((m?.match_date ?? '') > grp.maxDate) grp.maxDate = m.match_date ?? '';
    }
    return [...map.values()].sort((a, b) => b.maxDate.localeCompare(a.maxDate));
  }, [matches]);

  // Group by matchday, most recent jornada first
  const sections = useMemo(() => {
    const source = selectedMatchdayId ? filtered.filter(m => m?.matchday_id === selectedMatchdayId) : filtered;
    const map = new Map<string, { title: string; matchdayId: string; minDate: string; maxDate: string; data: MatchItem[] }>();
    for (const m of source) {
      const key = m?.matchday_id ?? 'unknown';
      if (!map.has(key)) {
        map.set(key, { title: m?.matchday?.name ?? 'Jornada', matchdayId: m?.matchday_id, minDate: m?.match_date ?? '', maxDate: m?.match_date ?? '', data: [] });
      }
      const grp = map.get(key)!;
      grp.data.push(m);
      if ((m?.match_date ?? '') < grp.minDate) grp.minDate = m.match_date ?? '';
      if ((m?.match_date ?? '') > grp.maxDate) grp.maxDate = m.match_date ?? '';
    }
    return [...map.values()].sort((a, b) => b.maxDate.localeCompare(a.maxDate));
  }, [filtered, selectedMatchdayId]);

  const scoreMutation = useMutation({
    mutationFn: async ({ matchId, sa, sb }: { matchId: string; sa: number; sb: number }) => {
      const res = await api.patch(`/api/matches/${matchId}/scores`, { score_a: sa, score_b: sb });
      return res?.data;
    },
    onSuccess: () => {
      showToast('success', 'Marcador actualizado ✅');
      // Al cambiar un marcador, varios datos derivados quedan stale:
      // matches, rankings, tickets/aciertos, bet-log, dashboards.
      queryClient.invalidateQueries({ queryKey: ['admin-all-matches'] });
      queryClient.invalidateQueries({ queryKey: ['matches'] });
      queryClient.invalidateQueries({ queryKey: ['ranking'] });
      queryClient.invalidateQueries({ queryKey: ['bet-log'] });
      queryClient.invalidateQueries({ queryKey: ['my-tickets'] });
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
      setEditingMatchId(null); setScoreA(''); setScoreB('');
    },
    onError: (error: any) => {
      showToast('error', error?.response?.data?.message || 'Error al guardar marcador');
    },
  });

  const handleStartEdit = (match: MatchItem) => {
    setEditingMatchId(match?.id);
    setScoreA(match?.score_a != null ? String(match.score_a) : '');
    setScoreB(match?.score_b != null ? String(match.score_b) : '');
  };

  const handleSaveScore = (matchId: string) => {
    const sa = parseInt(scoreA, 10);
    const sb = parseInt(scoreB, 10);
    if (isNaN(sa) || isNaN(sb) || sa < 0 || sb < 0) { showToast('error', 'Marcador inválido'); return; }
    if (Platform.OS !== 'web') Haptics.impactAsync?.(Haptics.ImpactFeedbackStyle.Medium);
    scoreMutation.mutate({ matchId, sa, sb });
  };

  const resultLabel = (r?: string | null) => {
    if (r === 'L') return 'Local';
    if (r === 'V') return 'Visitante';
    if (r === 'E') return 'Empate';
    return '';
  };

  const FILTERS: { key: FilterType; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
    { key: 'all',       label: 'Todos',      icon: 'list-outline' },
    { key: 'scheduled', label: 'Pendientes', icon: 'time-outline' },
    { key: 'finished',  label: 'Finalizados', icon: 'checkmark-circle-outline' },
  ];

  const scheduledCount = (matches ?? []).filter((m: MatchItem) => m?.status === 'scheduled').length;

  const renderSectionHeader = ({ section }: { section: { title: string; minDate: string; maxDate: string; data: MatchItem[] } }) => {
    const allFinished  = section.data.every((m) => m?.status === 'finished');
    const pendingCount = section.data.filter((m) => m?.status === 'scheduled').length;
    // Derive matchday_id from any match in this section (all share the same one)
    const matchdayId   = section.data[0]?.matchday_id;
    const dateRange = formatSectionDate(section.minDate) === formatSectionDate(section.maxDate)
      ? formatSectionDate(section.minDate)
      : `${formatSectionDate(section.minDate)} – ${formatSectionDate(section.maxDate)}`;
    return (
      <View style={[styles.sectionHeader, { backgroundColor: theme.colors.bg, borderBottomColor: theme.colors.border }]}>
        <View style={[styles.sectionHeaderDot, { backgroundColor: allFinished ? theme.colors.textMuted : theme.colors.primaryLight }]} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.sectionHeaderTitle, { color: theme.colors.textPrimary }]}>{section.title}</Text>
          {dateRange ? <Text style={[styles.sectionHeaderDate, { color: theme.colors.textMuted }]}>{dateRange}</Text> : null}
        </View>
        {pendingCount > 0 && (
          <View style={[styles.sectionBadge, { backgroundColor: theme.colors.primaryLight + '18', borderColor: theme.colors.primaryLight + '40' }]}>
            <Text style={[styles.sectionBadgeText, { color: theme.colors.primaryLight }]}>
              {pendingCount} pendiente{pendingCount !== 1 ? 's' : ''}
            </Text>
          </View>
        )}
        {allFinished && (
          <View style={[styles.sectionBadge, { backgroundColor: theme.colors.border, borderColor: 'transparent' }]}>
            <Text style={[styles.sectionBadgeText, { color: theme.colors.textMuted }]}>Completada</Text>
          </View>
        )}
        {/* Always-accessible ranking link */}
        {matchdayId && (
          <Pressable
            onPress={() => router.push(`/quiniela/ranking/${matchdayId}` as any)}
            style={({ pressed }) => [
              styles.rankingPill,
              pressed && { opacity: 0.7 },
            ]}
          >
            <Ionicons name="podium" size={11} color="#FFD700" />
            <Text style={styles.rankingPillText}>Ranking</Text>
          </Pressable>
        )}
      </View>
    );
  };

  const renderMatch = ({ item, index }: { item: MatchItem; index: number }) => {
    const isEditing  = editingMatchId === item?.id;
    const hasScore   = item?.score_a != null && item?.score_b != null;
    const isFinished = item?.status === 'finished';

    return (
      <Animated.View entering={FadeInDown.delay(index * 55).duration(340).springify()}>
        <View style={[styles.matchCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <LinearGradient
            colors={isFinished
              ? [theme.colors.border, theme.colors.border]
              : [theme.colors.primary, theme.colors.primaryLight, 'transparent']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={{ height: 1.5 }}
          />
          <View style={styles.matchCardBody}>
            {/* Teams row */}
            <View style={styles.teamsRow}>
              <View style={styles.teamSide}>
                <TeamFlag team={item?.team_a} size={46} />
                <Text style={[styles.teamName, { color: theme.colors.textPrimary }]} numberOfLines={1}>
                  {item?.team_a?.name ?? 'Local'}
                </Text>
              </View>

              {isEditing ? (
                <View style={styles.scoreInputs}>
                  <TextInput
                    style={[styles.scoreInput, { backgroundColor: theme.colors.surfaceElevated, borderColor: theme.colors.primaryLight, color: theme.colors.textPrimary }]}
                    value={scoreA} onChangeText={setScoreA}
                    keyboardType="numeric" maxLength={2} placeholder="0"
                    placeholderTextColor={theme.colors.textMuted} selectTextOnFocus
                  />
                  <Text style={[styles.scoreDash, { color: theme.colors.textMuted }]}>-</Text>
                  <TextInput
                    style={[styles.scoreInput, { backgroundColor: theme.colors.surfaceElevated, borderColor: theme.colors.primaryLight, color: theme.colors.textPrimary }]}
                    value={scoreB} onChangeText={setScoreB}
                    keyboardType="numeric" maxLength={2} placeholder="0"
                    placeholderTextColor={theme.colors.textMuted} selectTextOnFocus
                  />
                </View>
              ) : hasScore ? (
                <View style={styles.scoreDisplay}>
                  <Text style={[styles.scoreText, { color: theme.colors.textPrimary }]}>
                    {item.score_a} - {item.score_b}
                  </Text>
                  {item?.result && (
                    <Text style={[styles.resultText, { color: theme.colors.textMuted }]}>{resultLabel(item.result)}</Text>
                  )}
                </View>
              ) : (
                <Text style={[styles.vsText, { color: theme.colors.textMuted }]}>vs</Text>
              )}

              <View style={styles.teamSide}>
                <TeamFlag team={item?.team_b} size={46} />
                <Text style={[styles.teamName, { color: theme.colors.textPrimary }]} numberOfLines={1}>
                  {item?.team_b?.name ?? 'Visitante'}
                </Text>
              </View>
            </View>

            {/* Date + Status */}
            <View style={[styles.metaRow, { borderTopColor: theme.colors.border }]}>
              <Text style={[styles.dateText, { color: theme.colors.textSecondary }]}>
                {formatMatchDate(item?.match_date)}
              </Text>
              <Badge status={item?.status === 'finished' ? 'finished' : 'pending'} />
            </View>

            {/* Actions */}
            {isEditing ? (
              <View style={styles.editActions}>
                <Button
                  title="Cancelar" variant="outline" size="sm"
                  onPress={() => { setEditingMatchId(null); setScoreA(''); setScoreB(''); }}
                  style={{ flex: 1 }}
                />
                <Button
                  title="Guardar" variant="accent" size="sm"
                  loading={scoreMutation?.isPending}
                  onPress={() => handleSaveScore(item?.id)}
                  style={{ flex: 1 }}
                />
              </View>
            ) : (
              <View style={styles.actionRow}>
                <Pressable style={styles.actionBtn} onPress={() => handleStartEdit(item)}>
                  <Ionicons
                    name={hasScore ? 'create-outline' : 'clipboard-outline'}
                    size={15}
                    color={hasScore ? theme.colors.textSecondary : theme.colors.primaryLight}
                  />
                  <Text style={[styles.actionBtnText, { color: hasScore ? theme.colors.textSecondary : theme.colors.primaryLight }]}>
                    {hasScore ? 'Editar marcador' : 'Ingresar resultado'}
                  </Text>
                </Pressable>
                <View style={[styles.actionSep, { backgroundColor: theme.colors.border }]} />
                <Pressable
                  style={styles.actionBtn}
                  onPress={() => item?.matchday_id && router.push(`/tournament/matchday/${item.matchday_id}` as any)}
                >
                  <Ionicons name="open-outline" size={13} color={theme.colors.textMuted} />
                  <Text style={[styles.actionBtnMuted, { color: theme.colors.textMuted }]}>Ver jornada</Text>
                </Pressable>
              </View>
            )}
          </View>
        </View>
      </Animated.View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.bg }]} edges={['top']}>

      {/* Gradient header */}
      <LinearGradient
        colors={[theme.colors.primary, theme.colors.primaryLight]}
        start={{ x: 0, y: 0 }} end={{ x: 0.7, y: 1 }}
        style={styles.headerGrad}
      >
        <Animated.View entering={FadeIn.duration(350)} style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Resultados</Text>
            <Text style={styles.headerSub}>Ingresa el marcador de cada partido</Text>
          </View>
          {scheduledCount > 0 && (
            <View style={styles.countPill}>
              <Text style={styles.countNum}>{scheduledCount}</Text>
              <Text style={styles.countLabel}>pendientes</Text>
            </View>
          )}
          <View style={styles.headerIcon}>
            <Ionicons name="football" size={20} color={theme.colors.primaryLight} />
          </View>
        </Animated.View>
      </LinearGradient>

      {/* Info banner */}
      <Animated.View
        entering={FadeInDown.delay(50).duration(300)}
        style={[styles.infoBanner, { backgroundColor: theme.colors.primaryLight + '10', borderColor: theme.colors.primaryLight + '28' }]}
      >
        <Ionicons name="information-circle-outline" size={15} color={theme.colors.primaryLight} />
        <Text style={[styles.infoText, { color: theme.colors.textSecondary }]}>
          Para colocar tu propia apuesta ve a la pestaña{' '}
          <Text style={{ fontFamily: 'Poppins_700Bold' }}>Apostar</Text>
        </Text>
      </Animated.View>

      {/* Filter chips */}
      <Animated.View entering={FadeInDown.delay(80).duration(300)} style={styles.filterRow}>
        {FILTERS.map((f) => {
          const active = filter === f.key;
          return (
            <Pressable
              key={f.key}
              style={[
                styles.filterChip,
                { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
                active && { backgroundColor: theme.colors.primaryLight, borderColor: theme.colors.primaryLight },
              ]}
              onPress={() => setFilter(f.key)}
            >
              <Ionicons name={f.icon} size={13} color={active ? '#fff' : theme.colors.textMuted} />
              <Text style={[
                styles.filterText, { color: active ? '#fff' : theme.colors.textSecondary },
                active && { fontFamily: 'Poppins_700Bold' },
              ]}>{f.label}</Text>
            </Pressable>
          );
        })}
      </Animated.View>

      {/* Jornada dropdown */}
      {!isLoading && allJornadas.length > 0 && (
        <Animated.View entering={FadeInDown.delay(110).duration(300)} style={styles.dropdownRow}>
          <Pressable
            style={[styles.dropdownTrigger, { backgroundColor: theme.colors.surface, borderColor: selectedMatchdayId ? theme.colors.primaryLight : theme.colors.border }]}
            onPress={() => { setPickerSearch(''); setShowPicker(true); }}
          >
            <Ionicons name="calendar-outline" size={16} color={selectedMatchdayId ? theme.colors.primaryLight : theme.colors.textMuted} />
            <View style={{ flex: 1 }}>
              {selectedMatchdayId ? (
                <>
                  <Text style={[styles.dropdownLabel, { color: theme.colors.primaryLight }]}>Filtrando por</Text>
                  <Text style={[styles.dropdownValue, { color: theme.colors.textPrimary }]}>
                    {allJornadas.find(j => j.id === selectedMatchdayId)?.name ?? 'Jornada'}
                  </Text>
                </>
              ) : (
                <Text style={[styles.dropdownValue, { color: theme.colors.textMuted }]}>Todas las jornadas</Text>
              )}
            </View>
            {selectedMatchdayId ? (
              <Pressable onPress={() => setSelectedMatchdayId(null)} hitSlop={8}>
                <Ionicons name="close-circle" size={18} color={theme.colors.textMuted} />
              </Pressable>
            ) : (
              <Ionicons name="chevron-down" size={16} color={theme.colors.textMuted} />
            )}
          </Pressable>
        </Animated.View>
      )}

      {isLoading ? (
        <View style={{ padding: 20, gap: 12 }}>
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} width="100%" height={140} style={{ borderRadius: 16 }} />
          ))}
        </View>
      ) : sections.length === 0 ? (
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <EmptyState
            icon="football-outline"
            title={filter === 'scheduled' ? 'No hay pendientes' : filter === 'finished' ? 'Sin finalizados' : 'Sin partidos'}
            description="Los partidos se crean desde la gestión de jornadas en cada torneo"
          />
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item?.id ?? String(Math.random())}
          renderItem={renderMatch}
          renderSectionHeader={renderSectionHeader}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          stickySectionHeadersEnabled
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primaryLight} />
          }
        />
      )}
      {/* Jornada picker modal */}
      <Modal visible={showPicker} transparent animationType="fade" onRequestClose={() => setShowPicker(false)}>
        <Pressable style={styles.pickerOverlay} onPress={() => setShowPicker(false)}>
          <Pressable style={[styles.pickerCard, { backgroundColor: theme.colors.surface }]} onPress={() => {}}>

            {/* Header */}
            <View style={[styles.pickerHeader, { borderBottomColor: theme.colors.border }]}>
              <Ionicons name="calendar-outline" size={18} color={theme.colors.primaryLight} />
              <Text style={[styles.pickerTitle, { color: theme.colors.textPrimary }]}>Seleccionar Jornada</Text>
              <Pressable onPress={() => setShowPicker(false)} style={styles.pickerCloseBtn} hitSlop={8}>
                <Ionicons name="close" size={20} color={theme.colors.textMuted} />
              </Pressable>
            </View>

            {/* Search */}
            <View style={[styles.pickerSearchWrap, { backgroundColor: theme.colors.surfaceElevated, borderColor: theme.colors.border }]}>
              <Ionicons name="search-outline" size={16} color={theme.colors.textMuted} />
              <TextInput
                style={[styles.pickerSearchInput, { color: theme.colors.textPrimary }]}
                value={pickerSearch}
                onChangeText={setPickerSearch}
                placeholder="Buscar jornada..."
                placeholderTextColor={theme.colors.textMuted}
                autoFocus
              />
              {pickerSearch.length > 0 && (
                <Pressable onPress={() => setPickerSearch('')} hitSlop={8}>
                  <Ionicons name="close-circle" size={16} color={theme.colors.textMuted} />
                </Pressable>
              )}
            </View>

            {/* Options */}
            <ScrollView style={{ maxHeight: 320 }} showsVerticalScrollIndicator={false}>
              {/* Todas */}
              {'todas las jornadas'.includes(pickerSearch.toLowerCase()) && (
                <Pressable
                  style={[styles.pickerOption, { borderBottomColor: theme.colors.border },
                    !selectedMatchdayId && { backgroundColor: theme.colors.primaryLight + '10' }]}
                  onPress={() => { setSelectedMatchdayId(null); setShowPicker(false); }}
                >
                  <View style={[styles.pickerOptionIcon, { backgroundColor: !selectedMatchdayId ? theme.colors.primaryLight + '22' : theme.colors.surfaceElevated }]}>
                    <Ionicons name="list-outline" size={16} color={!selectedMatchdayId ? theme.colors.primaryLight : theme.colors.textMuted} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.pickerOptionName, { color: !selectedMatchdayId ? theme.colors.primaryLight : theme.colors.textPrimary }]}>Todas las jornadas</Text>
                    <Text style={[styles.pickerOptionDate, { color: theme.colors.textMuted }]}>{allJornadas.length} jornadas · todos los partidos</Text>
                  </View>
                  {!selectedMatchdayId && <Ionicons name="checkmark" size={18} color={theme.colors.primaryLight} />}
                </Pressable>
              )}
              {allJornadas
                .filter(j => j.name.toLowerCase().includes(pickerSearch.toLowerCase()))
                .map((j) => {
                  const active = selectedMatchdayId === j.id;
                  const dr = formatSectionDate(j.minDate) === formatSectionDate(j.maxDate)
                    ? formatSectionDate(j.minDate)
                    : `${formatSectionDate(j.minDate)} – ${formatSectionDate(j.maxDate)}`;
                  return (
                    <Pressable
                      key={j.id}
                      style={[styles.pickerOption, { borderBottomColor: theme.colors.border },
                        active && { backgroundColor: theme.colors.primaryLight + '10' }]}
                      onPress={() => { setSelectedMatchdayId(j.id); setShowPicker(false); }}
                    >
                      <View style={[styles.pickerOptionIcon, { backgroundColor: active ? theme.colors.primaryLight + '22' : theme.colors.surfaceElevated }]}>
                        <Ionicons name="calendar-outline" size={16} color={active ? theme.colors.primaryLight : theme.colors.textMuted} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.pickerOptionName, { color: active ? theme.colors.primaryLight : theme.colors.textPrimary }]}>{j.name}</Text>
                        <Text style={[styles.pickerOptionDate, { color: theme.colors.textMuted }]}>{dr}</Text>
                      </View>
                      {active && <Ionicons name="checkmark" size={18} color={theme.colors.primaryLight} />}
                    </Pressable>
                  );
                })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

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
  headerTitle: { fontSize: 22, fontFamily: 'Poppins_800ExtraBold', color: '#fff', letterSpacing: -0.4 },
  headerSub:   { fontSize: 12, fontFamily: 'Poppins_400Regular', color: 'rgba(255,255,255,0.6)', marginTop: 1 },
  countPill: {
    backgroundColor: 'rgba(0,0,0,0.22)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5,
    alignItems: 'center',
  },
  countNum:   { fontSize: 15, fontFamily: 'Poppins_700Bold', color: '#fff' },
  countLabel: { fontSize: 10, fontFamily: 'Poppins_500Medium', color: 'rgba(255,255,255,0.92)' },
  headerIcon: {
    width: 42, height: 42, borderRadius: 13,
    backgroundColor: 'rgba(0,0,0,0.22)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center', justifyContent: 'center',
  },

  infoBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 20, marginBottom: 6,
    borderRadius: 12, borderWidth: 1,
    paddingHorizontal: 12, paddingVertical: 9,
  },
  infoText: { flex: 1, fontSize: 12, fontFamily: 'Poppins_400Regular' },

  filterRow: { flexDirection: 'row', paddingHorizontal: 20, paddingVertical: 8, gap: 8 },
  filterChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 20, borderWidth: 1,
  },
  filterText: { fontSize: 12, fontFamily: 'Poppins_500Medium' },

  listContent: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 100 },

  matchCard: {
    borderRadius: 16, borderWidth: 1, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18, shadowRadius: 10, elevation: 5,
    marginBottom: 12,
  },
  matchCardBody: { padding: 14 },
  matchdayLabel: { fontSize: 11, fontFamily: 'Poppins_600SemiBold', marginBottom: 10, letterSpacing: 0.3 },

  teamsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  teamSide: { flex: 1, alignItems: 'center', gap: 4 },
  teamName: { fontSize: 12, fontFamily: 'Poppins_600SemiBold', textAlign: 'center' },

  vsText:      { fontSize: 12, fontFamily: 'Poppins_700Bold', paddingHorizontal: 12 },
  scoreDisplay: { alignItems: 'center', paddingHorizontal: 12 },
  scoreText:   { fontSize: 20, fontFamily: 'Poppins_800ExtraBold' },
  resultText:  { fontSize: 10, fontFamily: 'Poppins_400Regular', marginTop: 2 },

  scoreInputs: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 8 },
  scoreInput: {
    width: 46, height: 46, borderRadius: 12,
    borderWidth: 1.5, textAlign: 'center',
    fontSize: 18, fontFamily: 'Poppins_700Bold',
  },
  scoreDash: { fontSize: 18, fontFamily: 'Poppins_700Bold' },

  metaRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10,
  },
  dateText: { fontSize: 11, fontFamily: 'Poppins_400Regular' },

  editActions: { flexDirection: 'row', gap: 10, marginTop: 10 },
  actionRow:   { flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 8 },
  actionBtn:   { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 4 },
  actionBtnText: { fontSize: 12, fontFamily: 'Poppins_500Medium' },
  actionBtnMuted: { fontSize: 11, fontFamily: 'Poppins_400Regular' },
  actionSep: { width: 1, height: 16 },

  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 20, paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginBottom: 8,
  },
  sectionHeaderDot: { width: 8, height: 8, borderRadius: 4 },
  sectionHeaderTitle: { fontSize: 14, fontFamily: 'Poppins_700Bold' },
  sectionHeaderDate:  { fontSize: 11, fontFamily: 'Poppins_400Regular', marginTop: 1 },
  sectionBadge: {
    borderRadius: 8, borderWidth: 1,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  sectionBadgeText: { fontSize: 11, fontFamily: 'Poppins_600SemiBold' },
  rankingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginLeft: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#FFD70055',
    backgroundColor: '#FFD70015',
  },
  rankingPillText: {
    fontSize: 10,
    fontFamily: 'Poppins_700Bold',
    color: '#FFD700',
    letterSpacing: 0.3,
  },

  jornadaRow: { paddingHorizontal: 20, paddingBottom: 8, gap: 8 },

  dropdownRow: { paddingHorizontal: 20, paddingBottom: 10 },
  dropdownTrigger: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderRadius: 14, borderWidth: 1.5,
    paddingHorizontal: 14, paddingVertical: 11,
  },
  dropdownLabel: { fontSize: 10, fontFamily: 'Poppins_500Medium', marginBottom: 1 },
  dropdownValue: { fontSize: 13, fontFamily: 'Poppins_600SemiBold' },

  pickerOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center', alignItems: 'center', padding: 24,
  },
  pickerCard: {
    width: '100%', maxWidth: 480,
    borderRadius: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25, shadowRadius: 24, elevation: 12,
    overflow: 'hidden',
  },
  pickerHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 18, paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  pickerTitle: { flex: 1, fontSize: 15, fontFamily: 'Poppins_700Bold' },
  pickerCloseBtn: { padding: 2 },
  pickerSearchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 16, marginVertical: 12,
    borderRadius: 12, borderWidth: 1,
    paddingHorizontal: 12, paddingVertical: 9,
  },
  pickerSearchInput: { flex: 1, fontSize: 13, fontFamily: 'Poppins_400Regular', padding: 0 },
  pickerOption: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  pickerOptionIcon: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  pickerOptionName: { fontSize: 13, fontFamily: 'Poppins_600SemiBold' },
  pickerOptionDate: { fontSize: 11, fontFamily: 'Poppins_400Regular', marginTop: 2 },
});
