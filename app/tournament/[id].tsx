import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  Pressable,
  RefreshControl,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { safeGoBack } from '../../utils/navigation';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Badge } from '../../components/ui/Badge';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { DateTimePicker } from '../../components/ui/DateTimePicker';
import { Skeleton } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import { TeamFlag } from '../../components/ui/TeamFlag';
import { useToast } from '../../components/ui/Toast';
import { useAuthStore } from '../../store/authStore';
import { useTheme } from '../../contexts/ThemeContext';
import { theme as staticTheme } from '../../constants/theme';
import api from '../../services/api';
import { downloadPdf } from '../../services/downloadPdf';
import { parseBackendDate, toLocalDateString, toDDMMYYYY, toNoonISOString } from '../../utils/date';

type Tab = 'info' | 'teams' | 'matchdays' | 'groups' | 'participants';

export default function TournamentManageScreen() {
  const { id = '' } = useLocalSearchParams<{ id: string }>();
  const [activeTab, setActiveTab] = useState<Tab>('info');
  const [refreshing, setRefreshing] = useState(false);
  const queryClient = useQueryClient();
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const { data: tournament, isLoading, refetch } = useQuery({
    queryKey: ['tournament', id],
    queryFn: async () => {
      const res = await api.get(`/api/tournaments/${id}`);
      return res?.data;
    },
    enabled: !!id,
  });

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  // Refetch al volver a la pantalla (tras editar jornadas, equipos, etc.)
  useFocusEffect(useCallback(() => { refetch(); }, [id]));

  const tabs: { key: Tab; label: string; icon: string; show: boolean }[] = [
    { key: 'info', label: 'Info', icon: 'information-circle-outline', show: true },
    { key: 'teams', label: 'Equipos', icon: 'shield-outline', show: true },
    { key: 'matchdays', label: 'Jornadas', icon: 'calendar-outline', show: tournament?.type === 'matchday' },
    { key: 'groups', label: 'Grupos', icon: 'people-outline', show: false },
    { key: 'participants', label: 'Inscritos', icon: 'person-add-outline', show: true },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
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
              <Text style={styles.headerTitle} numberOfLines={1}>
                {isLoading ? 'Cargando...' : tournament?.name ?? 'Torneo'}
              </Text>
            </View>
            <View style={styles.headerIcon}>
              <Ionicons name="trophy" size={20} color="#FFD700" />
            </View>
          </View>
        </LinearGradient>
      </Animated.View>

      {/* Tabs */}
      <View style={styles.tabBar}>
        {tabs.filter(t => t.show).map(tab => (
          <Pressable
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && styles.tabActive]}
            onPress={() => setActiveTab(tab.key)}
          >
            <Ionicons
              name={tab.icon as any}
              size={18}
              color={activeTab === tab.key ? theme.colors.primaryLight : theme.colors.textMuted}
            />
            <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>
              {tab.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primaryLight} />
        }
      >
        {isLoading ? (
          <View style={{ padding: 20 }}>
            <Skeleton width="100%" height={200} />
          </View>
        ) : activeTab === 'info' ? (
          <InfoTab tournament={tournament} onUpdate={refetch} />
        ) : activeTab === 'teams' ? (
          <TeamsTab tournamentId={id} assignedTeams={tournament?.teams ?? []} onUpdate={refetch} />
        ) : activeTab === 'matchdays' ? (
          <MatchdaysTab tournamentId={id} />
        ) : activeTab === 'groups' ? (
          <GroupsTab tournamentId={id} />
        ) : activeTab === 'participants' ? (
          <ParticipantsTab tournamentId={id} />
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

/* ===== INFO TAB ===== */
function InfoTab({ tournament, onUpdate }: { tournament: any; onUpdate: () => void }) {
  const { showToast } = useToast();
  const { theme } = useTheme();
  const tabStyles = useMemo(() => makeTabStyles(theme), [theme]);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: tournament?.name ?? '',
    description: tournament?.description ?? '',
    status: tournament?.status ?? 'draft',
    bet_per_matchday: String(tournament?.bet_per_matchday ?? 10),
    bet_final: String(tournament?.bet_final ?? 5),
    // parseBackendDate evita el shift de timezone (las fechas @db.Date vienen
    // como medianoche UTC; new Date() las mostraria un dia antes en UTC-4).
    start_date: parseBackendDate(tournament?.start_date),
    end_date: parseBackendDate(tournament?.end_date),
    final_bet_deadline: tournament?.final_bet_deadline ? new Date(tournament.final_bet_deadline) : null as Date | null,
  });

  const statuses = ['draft', 'active', 'finished'];
  const statusLabels: Record<string, string> = { draft: 'Borrador', active: 'Activo', finished: 'Finalizado' };
  const statusColors: Record<string, string> = { draft: '#F59E0B', active: '#10B981', finished: '#94A3B8' };

  const handleSave = async () => {
    setLoading(true);
    try {
      // Validación: end_date no puede ser antes de start_date
      if (form.start_date && form.end_date && form.end_date < form.start_date) {
        showToast('error', 'La fecha de fin no puede ser anterior a la de inicio');
        setLoading(false);
        return;
      }
      await api.patch(`/api/tournaments/${tournament?.id}`, {
        name: form.name,
        description: form.description || undefined,
        bet_per_matchday: Number(form.bet_per_matchday),
        bet_final: Number(form.bet_final),
        // toNoonISOString ancla la fecha al mediodia local → el dia del calendario
        // se preserva sin importar el shift de timezone (evita guardar 1 dia antes).
        ...(form.start_date ? { start_date: toNoonISOString(form.start_date) } : {}),
        ...(form.end_date ? { end_date: toNoonISOString(form.end_date) } : {}),
        // El deadline es un timestamp real (con hora) → toISOString es correcto.
        ...(form.final_bet_deadline ? { final_bet_deadline: form.final_bet_deadline.toISOString() } : {}),
      });
      showToast('success', 'Torneo actualizado');
      setEditing(false);
      onUpdate();
    } catch (error: any) {
      showToast('error', error?.friendlyMessage || 'Error al actualizar');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (status: string) => {
    try {
      await api.patch(`/api/tournaments/${tournament?.id}/status`, { status });
      showToast('success', `Estado cambiado a "${statusLabels[status]}"`);
      onUpdate();
    } catch (error: any) {
      showToast('error', error?.friendlyMessage || 'Error al cambiar estado');
    }
  };

  return (
    <View>
      {/* Status selector */}
      <Text style={tabStyles.sectionTitle}>Estado del Torneo</Text>
      <View style={tabStyles.statusRow}>
        {statuses.map(s => (
          <Pressable
            key={s}
            style={[
              tabStyles.statusChip,
              { borderColor: statusColors[s] },
              tournament?.status === s && { backgroundColor: `${statusColors[s]}20` },
            ]}
            onPress={() => handleStatusChange(s)}
          >
            <View style={[tabStyles.statusDot, { backgroundColor: statusColors[s] }]} />
            <Text style={[tabStyles.statusChipText, { color: statusColors[s] }]}>
              {statusLabels[s]}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Editable info */}
      <Text style={tabStyles.sectionTitle}>Información</Text>
      <Card>
        {editing ? (
          <>
            <Input label="Nombre" value={form.name} onChangeText={v => setForm({ ...form, name: v })} />
            <Input label="Descripción" value={form.description} onChangeText={v => setForm({ ...form, description: v })} multiline />
            <View style={tabStyles.row}>
              <View style={{ flex: 1 }}>
                <Input label={`${tournament?.currency ?? 'Bs'} por Jornada (X)`} value={form.bet_per_matchday} onChangeText={v => setForm({ ...form, bet_per_matchday: v })} type="number" />
              </View>
              <View style={{ width: 8 }} />
              <View style={{ flex: 1 }}>
                <Input label={`${tournament?.currency ?? 'Bs'} Polla Final (Y)`} value={form.bet_final} onChangeText={v => setForm({ ...form, bet_final: v })} type="number" />
              </View>
            </View>
            <View style={tabStyles.row}>
              <View style={{ flex: 1 }}>
                <DateTimePicker
                  label="Fecha Inicio"
                  value={form.start_date}
                  onChange={d => setForm({ ...form, start_date: d })}
                  mode="date"
                />
              </View>
              <View style={{ width: 8 }} />
              <View style={{ flex: 1 }}>
                <DateTimePicker
                  label="Fecha Fin"
                  value={form.end_date}
                  onChange={d => setForm({ ...form, end_date: d })}
                  mode="date"
                  minimumDate={form.start_date ?? undefined}
                />
              </View>
            </View>
            <DateTimePicker
              label="Fecha Límite Polla Final"
              value={form.final_bet_deadline}
              onChange={d => setForm({ ...form, final_bet_deadline: d })}
              mode="datetime"
              minimumDate={new Date()}
            />
            <View style={tabStyles.editActions}>
              <Button title="Cancelar" variant="outline" size="sm" onPress={() => setEditing(false)} />
              <Button title="Guardar" variant="primary" size="sm" onPress={handleSave} loading={loading} />
            </View>
          </>
        ) : (
          <>
            <View style={tabStyles.infoRow}>
              <Text style={tabStyles.infoLabel}>Nombre</Text>
              <Text style={tabStyles.infoValue}>{tournament?.name}</Text>
            </View>
            <View style={tabStyles.infoRow}>
              <Text style={tabStyles.infoLabel}>Tipo</Text>
              <Text style={tabStyles.infoValue}>
                {tournament?.type === 'matchday' ? 'Apuestas' : 'Grupos'}
              </Text>
            </View>
            <View style={tabStyles.infoRow}>
              <Text style={tabStyles.infoLabel}>Inicio</Text>
              <Text style={tabStyles.infoValue}>
                {(() => { const d = parseBackendDate(tournament?.start_date); return d ? toDDMMYYYY(d) : '—'; })()}
              </Text>
            </View>
            <View style={tabStyles.infoRow}>
              <Text style={tabStyles.infoLabel}>Fin</Text>
              <Text style={tabStyles.infoValue}>
                {(() => { const d = parseBackendDate(tournament?.end_date); return d ? toDDMMYYYY(d) : '—'; })()}
              </Text>
            </View>
            <View style={tabStyles.infoRow}>
              <Text style={tabStyles.infoLabel}>Apuesta/Jornada</Text>
              <Text style={tabStyles.infoValue}>{tournament?.currency ?? 'Bs'} {tournament?.bet_per_matchday}</Text>
            </View>
            <View style={tabStyles.infoRow}>
              <Text style={tabStyles.infoLabel}>Polla Final</Text>
              <Text style={tabStyles.infoValue}>{tournament?.currency ?? 'Bs'} {tournament?.bet_final}/jornada</Text>
            </View>
            <View style={tabStyles.infoRow}>
              <Text style={tabStyles.infoLabel}>Fecha Límite Polla</Text>
              <Text style={tabStyles.infoValue}>
                {tournament?.final_bet_deadline
                  ? (() => { const d = new Date(tournament.final_bet_deadline); return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}  ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`; })()
                  : 'Sin límite'}
              </Text>
            </View>
            <View style={tabStyles.infoRow}>
              <Text style={tabStyles.infoLabel}>Participantes</Text>
              <Text style={tabStyles.infoValue}>{tournament?._count?.participants ?? 0}</Text>
            </View>
            <View style={tabStyles.row}>
              <Button title="Editar" icon="create-outline" variant="ghost" size="sm" onPress={() => setEditing(true)} />
              <Button
                title="PDF Acumulado"
                icon="download-outline"
                variant="outline"
                size="sm"
                onPress={() => {
                  downloadPdf(
                    `/api/reports/tournament/${tournament?.id}/accumulated/pdf`,
                    `acumulado-${(tournament?.name ?? 'torneo').replace(/\s/g, '-')}.pdf`
                  ).catch(() => showToast('error', 'Error al descargar PDF'));
                }}
              />
            </View>
          </>
        )}
      </Card>
    </View>
  );
}

/* ===== TEAMS TAB ===== */
function TeamsTab({ tournamentId, assignedTeams, onUpdate }: { tournamentId: string; assignedTeams: any[]; onUpdate: () => void }) {
  const { showToast } = useToast();
  const { theme } = useTheme();
  const tabStyles = useMemo(() => makeTabStyles(theme), [theme]);
  const [showCreateTeam, setShowCreateTeam] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [selected, setSelected] = useState<string[]>(assignedTeams?.map?.((t: any) => t?.id) ?? []);
  // Tracks IDs that are actually persisted in the DB (separate from local `selected` state)
  const [savedTeamIds, setSavedTeamIds] = useState<Set<string>>(
    new Set(assignedTeams?.map?.((t: any) => t?.id) ?? [])
  );

  const { data: allTeams, isLoading, refetch: refetchTeams } = useQuery({
    queryKey: ['teams'],
    queryFn: async () => {
      const res = await api.get('/api/teams');
      return res?.data ?? [];
    },
  });

  const toggleTeam = (teamId: string) => {
    setSelected(prev =>
      prev.includes(teamId) ? prev.filter(id => id !== teamId) : [...prev, teamId]
    );
  };

  // Whether the local selection differs from what's saved in DB
  const hasUnsavedChanges =
    selected.length !== savedTeamIds.size ||
    selected.some(id => !savedTeamIds.has(id));

  const saveTeams = async () => {
    setSaving(true);
    try {
      await api.post(`/api/tournaments/${tournamentId}/teams`, { team_ids: selected });
      setSavedTeamIds(new Set(selected));
      showToast('success', 'Equipos actualizados');
      onUpdate();
    } catch (error: any) {
      showToast('error', error?.friendlyMessage || 'Error al guardar equipos');
    } finally {
      setSaving(false);
    }
  };

  const [editingTeam, setEditingTeam] = useState<any>(null);

  const handleCreateTeam = async (name: string, country: string, shieldUrl?: string) => {
    try {
      const res = await api.post('/api/teams', { name, country, ...(shieldUrl ? { shield_url: shieldUrl } : {}) });
      const newTeamId: string = res?.data?.id;
      // Auto-assign the new team to this tournament immediately
      const updatedIds = [...Array.from(savedTeamIds), newTeamId];
      await api.post(`/api/tournaments/${tournamentId}/teams`, { team_ids: updatedIds });
      setSelected(updatedIds);
      setSavedTeamIds(new Set(updatedIds));
      // AWAIT both refetches → la lista del torneo (padre) ya tiene el equipo
      // antes de cerrar el modal. Sin esto, hay un flash de "lista vieja".
      await Promise.all([refetchTeams(), Promise.resolve(onUpdate())]);
      showToast('success', 'Equipo creado y asignado al torneo');
      setShowCreateTeam(false);
    } catch (error: any) {
      showToast('error', error?.friendlyMessage || 'Error al crear equipo');
    }
  };

  const handleEditTeam = async (id: string, name: string, country: string, shieldUrl?: string) => {
    try {
      await api.patch(`/api/teams/${id}`, { name, country, shield_url: shieldUrl || null });
      await Promise.all([refetchTeams(), Promise.resolve(onUpdate())]);
      showToast('success', 'Equipo actualizado');
      setEditingTeam(null);
    } catch (error: any) {
      showToast('error', error?.friendlyMessage || 'Error al editar equipo');
    }
  };

  const handleDeleteTeam = async (id: string, name: string) => {
    const doDelete = async () => {
      try {
        await api.delete(`/api/teams/${id}`);
        // refetch ambos para que la card desaparezca al instante
        await Promise.all([refetchTeams(), Promise.resolve(onUpdate())]);
        showToast('success', `${name} eliminado`);
      } catch (error: any) {
        showToast('error', error?.friendlyMessage || 'Error al eliminar equipo');
      }
    };
    if (Platform.OS === 'web') {
      if (window.confirm(`¿Eliminar equipo "${name}"?`)) doDelete();
    } else {
      Alert.alert('Eliminar Equipo', `¿Eliminar "${name}"? Esta acción no se puede deshacer.`, [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Eliminar', style: 'destructive', onPress: doDelete },
      ]);
    }
  };

  // Optimistic override de la estrella (cuartos). El refetch del padre
  // (onUpdate) puede tardar — sobre todo en iOS web — así que aplicamos el
  // cambio localmente al instante y lo reconciliamos cuando llega el server.
  const [quartersOverride, setQuartersOverride] = useState<Map<string, boolean>>(new Map());

  const toggleQuarters = async (teamId: string, current: boolean) => {
    const next = !current;
    // 1) Optimistic: actualiza la UI YA
    setQuartersOverride(prev => {
      const m = new Map(prev);
      m.set(teamId, next);
      return m;
    });
    try {
      await api.patch(`/api/tournaments/${tournamentId}/team-quarters`, {
        team_id: teamId,
        advanced_to_quarters: next,
      });
      showToast('success', next ? 'Equipo en cuartos ✅' : 'Removido de cuartos');
      onUpdate();
    } catch (error: any) {
      // 2) Revertir el optimistic si falló
      setQuartersOverride(prev => {
        const m = new Map(prev);
        m.set(teamId, current);
        return m;
      });
      showToast('error', error?.friendlyMessage || 'Error');
    }
  };

  // Sync local state when server data changes (e.g. after refetch)
  useEffect(() => {
    const ids = assignedTeams?.map?.((t: any) => t?.id) ?? [];
    setSelected(ids);
    setSavedTeamIds(new Set(ids));
    // El server ya refleja la verdad → limpiamos overrides que coincidan,
    // para no quedar pegados a un valor optimista viejo.
    setQuartersOverride(prev => {
      if (prev.size === 0) return prev;
      const m = new Map(prev);
      (assignedTeams ?? []).forEach((t: any) => {
        if (m.has(t?.id) && m.get(t?.id) === (t?.advanced_to_quarters === true)) {
          m.delete(t?.id);
        }
      });
      return m;
    });
  }, [assignedTeams]);

  // Build a map of quarter-advanced teams: server data + optimistic override
  const quartersMap = new Map<string, boolean>();
  (assignedTeams ?? []).forEach((t: any) => {
    quartersMap.set(t?.id, t?.advanced_to_quarters === true);
  });
  // El override gana sobre el valor del server (refleja el último tap)
  quartersOverride.forEach((val, id) => quartersMap.set(id, val));

  // Only show teams that are assigned to this tournament (sorted alphabetically)
  const assignedTeamList = (allTeams ?? [])
    .filter((team: any) => savedTeamIds.has(team?.id))
    .sort((a: any, b: any) => (a?.name ?? '').localeCompare(b?.name ?? '', 'es'));

  // Apply search filter (case-insensitive, matches name or country)
  const normalizedQuery = searchText.trim().toLowerCase();
  const filteredTeamList = normalizedQuery
    ? assignedTeamList.filter((team: any) =>
        (team?.name ?? '').toLowerCase().includes(normalizedQuery) ||
        (team?.country ?? '').toLowerCase().includes(normalizedQuery)
      )
    : assignedTeamList;

  const totalCount    = assignedTeamList.length;
  const filteredCount = filteredTeamList.length;

  return (
    <View>
      <View style={tabStyles.sectionHeader}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
          <Text style={tabStyles.sectionTitle}>Equipos del Torneo</Text>
          {totalCount > 0 && (
            <View style={tabStyles.countBadge}>
              <Text style={tabStyles.countBadgeText}>{totalCount}</Text>
            </View>
          )}
        </View>
        <Button title="+ Equipo" variant="ghost" size="sm" onPress={() => setShowCreateTeam(true)} />
      </View>

      {/* Search bar — only show when there are teams to search */}
      {totalCount > 0 && (
        <View style={tabStyles.searchWrap}>
          <Ionicons name="search" size={18} color={theme.colors.textMuted} style={{ marginRight: 8 }} />
          <TextInput
            style={tabStyles.searchInput}
            value={searchText}
            onChangeText={setSearchText}
            placeholder="Buscar equipo o país…"
            placeholderTextColor={theme.colors.textMuted}
            autoCorrect={false}
            autoCapitalize="none"
          />
          {searchText.length > 0 && (
            <Pressable onPress={() => setSearchText('')} style={{ padding: 4 }}>
              <Ionicons name="close-circle" size={18} color={theme.colors.textMuted} />
            </Pressable>
          )}
        </View>
      )}

      {/* Result counter when filtering */}
      {normalizedQuery && (
        <Text style={tabStyles.searchResultText}>
          {filteredCount === 0
            ? 'Sin resultados'
            : `${filteredCount} de ${totalCount} ${filteredCount === 1 ? 'equipo' : 'equipos'}`}
        </Text>
      )}

      {isLoading ? (
        [1, 2, 3, 4].map(i => <Skeleton key={i} width="100%" height={48} style={{ marginBottom: 8 }} />)
      ) : totalCount === 0 ? (
        <EmptyState icon="shield-outline" title="Sin equipos" description="Crea el primer equipo del torneo" />
      ) : filteredCount === 0 ? (
        <EmptyState icon="search-outline" title="Sin resultados" description={`No hay equipos que coincidan con "${searchText}"`} />
      ) : (
        filteredTeamList.map((team: any, index: number) => {
          const inQuarters = quartersMap.get(team?.id) ?? false;
          return (
            <View
              key={team?.id}
              style={tabStyles.teamRow}
            >
              <View style={tabStyles.teamNumber}>
                <Text style={tabStyles.teamNumberText}>{index + 1}</Text>
              </View>
              <View style={tabStyles.teamAvatar}>
                <TeamFlag team={team} size={28} />
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={tabStyles.teamName}>{team?.name}</Text>
                  {inQuarters && (
                    <View style={{ backgroundColor: 'rgba(245,158,11,0.2)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
                      <Text style={{ color: '#F59E0B', fontSize: 10, fontFamily: 'Poppins_800ExtraBold' }}>CUARTOS</Text>
                    </View>
                  )}
                </View>
                <Text style={tabStyles.teamCountry}>{team?.country}</Text>
              </View>
              <Pressable
                onPress={() => toggleQuarters(team?.id, inQuarters)}
                style={{ padding: 6, marginRight: 6 }}
              >
                <Ionicons
                  name={inQuarters ? 'star' : 'star-outline'}
                  size={22}
                  color={inQuarters ? '#F59E0B' : theme.colors.textMuted}
                />
              </Pressable>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Pressable onPress={() => setEditingTeam(team)} style={{ padding: 4 }}>
                  <Ionicons name="pencil" size={16} color={theme.colors.primaryLight} />
                </Pressable>
                <Pressable onPress={() => handleDeleteTeam(team?.id, team?.name)} style={{ padding: 4 }}>
                  <Ionicons name="trash" size={16} color="#EF4444" />
                </Pressable>
              </View>
            </View>
          );
        })
      )}

      <CreateTeamModal visible={showCreateTeam} onClose={() => setShowCreateTeam(false)} onCreate={handleCreateTeam} />
      {editingTeam && (
        <EditTeamModal
          visible={!!editingTeam}
          team={editingTeam}
          onClose={() => setEditingTeam(null)}
          onSave={handleEditTeam}
        />
      )}
    </View>
  );
}

function CreateTeamModal({ visible, onClose, onCreate }: { visible: boolean; onClose: () => void; onCreate: (name: string, country: string, shieldUrl?: string) => void }) {
  const [name, setName] = useState('');
  const [country, setCountry] = useState('');
  const [shieldUrl, setShieldUrl] = useState('');
  const { theme } = useTheme();
  const tabStyles = useMemo(() => makeTabStyles(theme), [theme]);

  return (
    <Modal visible={visible} onClose={onClose}>
      <Text style={tabStyles.modalTitle}>Nuevo Equipo</Text>
      <Input label="Nombre" value={name} onChangeText={setName} placeholder="Ej: México" />
      <Input label="País" value={country} onChangeText={setCountry} placeholder="Ej: México" />
      <Input label="Escudo (URL imagen)" value={shieldUrl} onChangeText={setShieldUrl} placeholder="https://www.shutterstock.com/image-vector/set-four-distinct-shield-emblem-260nw-2707002831.jpg" />
      <View style={tabStyles.editActions}>
        <Button title="Cancelar" variant="outline" size="md" onPress={onClose} />
        <Button title="Crear" variant="primary" size="md" onPress={() => {
          onCreate(name, country, shieldUrl?.trim() || undefined);
          setName(''); setCountry(''); setShieldUrl('');
        }} />
      </View>
    </Modal>
  );
}

function EditTeamModal({ visible, team, onClose, onSave }: { visible: boolean; team: any; onClose: () => void; onSave: (id: string, name: string, country: string, shieldUrl?: string) => void }) {
  const [name, setName] = useState(team?.name ?? '');
  const [country, setCountry] = useState(team?.country ?? '');
  const [shieldUrl, setShieldUrl] = useState(team?.shield_url ?? '');
  const { theme } = useTheme();
  const tabStyles = useMemo(() => makeTabStyles(theme), [theme]);

  React.useEffect(() => {
    if (team) {
      setName(team?.name ?? '');
      setCountry(team?.country ?? '');
      setShieldUrl(team?.shield_url ?? '');
    }
  }, [team]);

  return (
    <Modal visible={visible} onClose={onClose}>
      <Text style={tabStyles.modalTitle}>Editar Equipo</Text>
      <Input label="Nombre" value={name} onChangeText={setName} placeholder="Ej: México" />
      <Input label="País" value={country} onChangeText={setCountry} placeholder="Ej: México" />
      <Input label="Escudo (URL imagen)" value={shieldUrl} onChangeText={setShieldUrl} placeholder="URL de imagen del escudo (opcional)" />
      <View style={tabStyles.editActions}>
        <Button title="Cancelar" variant="outline" size="md" onPress={onClose} />
        <Button title="Guardar" variant="primary" size="md" onPress={() => {
          onSave(team?.id, name, country, shieldUrl?.trim() || undefined);
        }} />
      </View>
    </Modal>
  );
}

/* ===== MATCHDAYS TAB ===== */
function MatchdaysTab({ tournamentId }: { tournamentId: string }) {
  const { showToast } = useToast();
  const { theme } = useTheme();
  const tabStyles = useMemo(() => makeTabStyles(theme), [theme]);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDate, setNewDate] = useState<Date | null>(null);
  const queryClient = useQueryClient();

  const { data: matchdays, isLoading } = useQuery({
    queryKey: ['matchdays', tournamentId],
    queryFn: async () => {
      const res = await api.get(`/api/matchdays?tournament_id=${tournamentId}`);
      return res?.data ?? [];
    },
  });

  // Pull the tournament so we can compute expected pool = participants × bet_per_matchday
  const { data: tournament } = useQuery({
    queryKey: ['tournament', tournamentId],
    queryFn: async () => {
      const res = await api.get(`/api/tournaments/${tournamentId}`);
      return res?.data ?? null;
    },
    enabled: !!tournamentId,
  });

  const participantCount = Number(
    tournament?._count?.participants ?? tournament?.participants?.length ?? 0,
  );
  const betPerMatchday = Number(tournament?.bet_per_matchday ?? 0);
  const currency       = tournament?.currency ?? 'Bs';
  // Expected pool if all inscritos bet (what the user asked for)
  const expectedPool = participantCount * betPerMatchday;

  const handleCreate = async () => {
    if (!newName?.trim() || !newDate) {
      showToast('error', 'Nombre y fecha son requeridos');
      return;
    }
    try {
      // Send local-day YYYY-MM-DD to avoid UTC off-by-one shift
      await api.post('/api/matchdays', { tournament_id: tournamentId, name: newName.trim(), date: toLocalDateString(newDate) });
      showToast('success', 'Jornada creada');
      queryClient.invalidateQueries({ queryKey: ['matchdays', tournamentId] });
      setShowCreate(false);
      setNewName('');
      setNewDate(null);
    } catch (error: any) {
      showToast('error', error?.friendlyMessage || 'Error al crear jornada');
    }
  };

  return (
    <View>
      <View style={tabStyles.sectionHeader}>
        <Text style={tabStyles.sectionTitle}>Jornadas</Text>
        <Button title="+ Jornada" variant="ghost" size="sm" onPress={() => setShowCreate(true)} />
      </View>

      {isLoading ? (
        [1, 2].map(i => <Skeleton key={i} width="100%" height={80} style={{ marginBottom: 8 }} />)
      ) : (matchdays?.length ?? 0) === 0 ? (
        <EmptyState icon="calendar-outline" title="No hay jornadas" description="Crea la primera jornada del torneo" />
      ) : (
        matchdays?.map?.((md: any) => {
          // Expected pozo = participants × bet_per_matchday (full potential pool).
          // Fall back to backend's `total_pool` if no tournament data yet.
          const pozo = expectedPool > 0
            ? expectedPool
            : Number(md?.total_pool ?? 0);
          const parsedDate = parseBackendDate(md?.date);
          return (
            <Card key={md?.id} style={{ marginBottom: 8 }} onPress={() => router.push(`/tournament/matchday/${md?.id}` as any)}>
              <View style={tabStyles.matchdayRow}>
                <View style={{ flex: 1 }}>
                  <Text style={tabStyles.matchdayName}>{md?.name}</Text>
                  <Text style={tabStyles.matchdayDate}>
                    📅 {parsedDate ? toDDMMYYYY(parsedDate) : '—'}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <View style={[tabStyles.statusChip, { borderColor: md?.status === 'open' ? '#10B981' : '#94A3B8' }]}>
                    <Text style={[tabStyles.statusChipText, { color: md?.status === 'open' ? '#10B981' : '#94A3B8' }]}>
                      {md?.status === 'open' ? 'Abierta' : md?.status === 'resolved' ? 'Resuelta' : md?.status}
                    </Text>
                  </View>
                  <Text style={tabStyles.poolText}>Pozo: {currency} {pozo.toFixed(2)}</Text>
                  {/* Ranking shortcut — direct access without going through matchday detail */}
                  <Pressable
                    onPress={(e: any) => {
                      e.stopPropagation?.();
                      router.push(`/quiniela/ranking/${md?.id}` as any);
                    }}
                    style={({ pressed }) => [
                      tabStyles.rankingShortcut,
                      pressed && { opacity: 0.7 },
                    ]}
                  >
                    <Ionicons name="podium" size={11} color="#FFD700" />
                    <Text style={tabStyles.rankingShortcutText}>Ver ranking</Text>
                  </Pressable>
                </View>
              </View>
            </Card>
          );
        })
      )}

      <Modal visible={showCreate} onClose={() => setShowCreate(false)}>
        <Text style={tabStyles.modalTitle}>Nueva Jornada</Text>
        <Input label="Nombre" value={newName} onChangeText={setNewName} placeholder="Ej: Jornada 1" />
        <DateTimePicker label="Fecha" value={newDate} onChange={setNewDate} mode="date" minimumDate={new Date('2025-01-01')} />
        <View style={tabStyles.editActions}>
          <Button title="Cancelar" variant="outline" size="md" onPress={() => setShowCreate(false)} />
          <Button title="Crear" variant="primary" size="md" onPress={handleCreate} />
        </View>
      </Modal>
    </View>
  );
}

/* ===== GROUPS TAB ===== */
function GroupsTab({ tournamentId }: { tournamentId: string }) {
  const { showToast } = useToast();
  const { theme } = useTheme();
  const tabStyles = useMemo(() => makeTabStyles(theme), [theme]);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const queryClient = useQueryClient();

  const { data: groups, isLoading } = useQuery({
    queryKey: ['groups', tournamentId],
    queryFn: async () => {
      const res = await api.get(`/api/groups?tournament_id=${tournamentId}`);
      return res?.data ?? [];
    },
  });

  const handleCreate = async () => {
    if (!newName?.trim()) { showToast('error', 'El nombre es requerido'); return; }
    try {
      await api.post('/api/groups', { tournament_id: tournamentId, name: newName.trim(), team_ids: [] });
      showToast('success', 'Grupo creado');
      queryClient.invalidateQueries({ queryKey: ['groups', tournamentId] });
      setShowCreate(false);
      setNewName('');
    } catch (error: any) {
      showToast('error', error?.friendlyMessage || 'Error al crear grupo');
    }
  };

  return (
    <View>
      <View style={tabStyles.sectionHeader}>
        <Text style={tabStyles.sectionTitle}>Grupos</Text>
        <Button title="+ Grupo" variant="ghost" size="sm" onPress={() => setShowCreate(true)} />
      </View>

      {isLoading ? (
        [1, 2].map(i => <Skeleton key={i} width="100%" height={80} style={{ marginBottom: 8 }} />)
      ) : (groups?.length ?? 0) === 0 ? (
        <EmptyState icon="people-outline" title="No hay grupos" description="Crea el primer grupo del torneo" />
      ) : (
        groups?.map?.((g: any) => (
          <Card key={g?.id} style={{ marginBottom: 8 }} onPress={() => router.push(`/tournament/group/${g?.id}` as any)}>
            <Text style={tabStyles.matchdayName}>{g?.name}</Text>
            <Text style={tabStyles.matchdayDate}>
              {(g?.team_ids?.length ?? 0)} equipos · Pozo: ${Number(g?.total_pool ?? 0).toFixed(2)}
            </Text>
          </Card>
        ))
      )}

      <Modal visible={showCreate} onClose={() => setShowCreate(false)}>
        <Text style={tabStyles.modalTitle}>Nuevo Grupo</Text>
        <Input label="Nombre" value={newName} onChangeText={setNewName} placeholder="Ej: Grupo A" />
        <View style={tabStyles.editActions}>
          <Button title="Cancelar" variant="outline" size="md" onPress={() => setShowCreate(false)} />
          <Button title="Crear" variant="primary" size="md" onPress={handleCreate} />
        </View>
      </Modal>
    </View>
  );
}

/* ===== PARTICIPANTS TAB ===== */
function ParticipantsTab({ tournamentId }: { tournamentId: string }) {
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const { theme } = useTheme();
  const tabStyles = useMemo(() => makeTabStyles(theme), [theme]);

  const { data: participants, isLoading } = useQuery({
    queryKey: ['tournament-participants', tournamentId],
    queryFn: async () => {
      try {
        const res = await api.get(`/api/tournament-participants/tournament/${tournamentId}`);
        return res?.data ?? [];
      } catch { return []; }
    },
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await api.patch(`/api/tournament-participants/${id}/status`, { status });
      return res?.data;
    },
    onSuccess: (_data: any, vars: { id: string; status: string }) => {
      showToast('success', vars.status === 'approved' ? 'Participante aprobado' : 'Solicitud rechazada');
      queryClient.invalidateQueries({ queryKey: ['tournament-participants', tournamentId] });
    },
    onError: (err: any) => {
      showToast('error', err?.response?.data?.message ?? 'Error');
    },
  });

  const selfEnrollMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post('/api/tournament-participants', { tournament_id: tournamentId });
      return res?.data;
    },
    onSuccess: () => {
      showToast('success', 'Te has inscrito y aprobado en el torneo');
      queryClient.invalidateQueries({ queryKey: ['tournament-participants', tournamentId] });
    },
    onError: (err: any) => {
      showToast('error', err?.response?.data?.message ?? 'Error al inscribirse');
    },
  });

  const pending = (participants ?? []).filter((p: any) => p?.status === 'pending');
  const approved = (participants ?? []).filter((p: any) => p?.status === 'approved');
  const rejected = (participants ?? []).filter((p: any) => p?.status === 'rejected');

  const renderUser = (p: any, showActions: boolean) => (
    <View key={p?.id} style={tabStyles.participantRow}>
      <View style={{ flex: 1 }}>
        <Text style={tabStyles.participantName}>{p?.user?.full_name ?? '—'}</Text>
        <Text style={tabStyles.participantInfo}>@{p?.user?.username ?? '—'} · CI: {p?.user?.ci ?? '—'}</Text>
      </View>
      {showActions ? (
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Pressable
            style={[tabStyles.actionChip, { backgroundColor: 'rgba(16,185,129,0.15)' }]}
            onPress={() => statusMutation.mutate({ id: p?.id, status: 'approved' })}
          >
            <Ionicons name="checkmark" size={16} color={theme.colors.success} />
          </Pressable>
          <Pressable
            style={[tabStyles.actionChip, { backgroundColor: 'rgba(211,47,47,0.15)' }]}
            onPress={() => statusMutation.mutate({ id: p?.id, status: 'rejected' })}
          >
            <Ionicons name="close" size={16} color={theme.colors.error} />
          </Pressable>
        </View>
      ) : (
        <Badge status={p?.status === 'approved' ? 'active' : 'blocked'} text={p?.status === 'approved' ? 'Aprobado' : 'Rechazado'} />
      )}
    </View>
  );

  // Check if admin is already enrolled
  const adminAlreadyEnrolled = user?.role === 'admin' && (participants ?? []).some(
    (p: any) => p?.user?.id === user?.id || p?.user?.username === user?.username,
  );

  return (
    <View>
      <View style={tabStyles.sectionHeader}>
        <Text style={tabStyles.sectionTitle}>Participantes ({(participants ?? []).length})</Text>
      </View>

      {/* Admin self-enroll button */}
      {user?.role === 'admin' && !adminAlreadyEnrolled && (
        <Button
          title="Inscribirme en este torneo"
          variant="primary"
          fullWidth
          icon="person-add-outline"
          loading={selfEnrollMutation.isPending}
          onPress={() => selfEnrollMutation.mutate()}
          style={{ marginBottom: 16 }}
        />
      )}
      {user?.role === 'admin' && adminAlreadyEnrolled && (
        <View style={tabStyles.enrolledBanner}>
          <Ionicons name="checkmark-circle" size={16} color={theme.colors.success} />
          <Text style={tabStyles.enrolledBannerText}>Ya estás inscrito en este torneo</Text>
        </View>
      )}

      {isLoading ? (
        [1, 2, 3].map(i => <Skeleton key={i} width="100%" height={50} style={{ marginBottom: 8 }} />)
      ) : (participants?.length ?? 0) === 0 ? (
        <EmptyState icon="person-add-outline" title="Sin solicitudes" description="Aún nadie ha solicitado participar" />
      ) : (
        <View>
          {pending.length > 0 && (
            <View>
              <Text style={tabStyles.subSectionTitle}>⏳ Pendientes ({pending.length})</Text>
              {pending.map((p: any) => renderUser(p, true))}
            </View>
          )}
          {approved.length > 0 && (
            <View style={{ marginTop: 16 }}>
              <Text style={tabStyles.subSectionTitle}>✅ Aprobados ({approved.length})</Text>
              {approved.map((p: any) => renderUser(p, false))}
            </View>
          )}
          {rejected.length > 0 && (
            <View style={{ marginTop: 16 }}>
              <Text style={tabStyles.subSectionTitle}>❌ Rechazados ({rejected.length})</Text>
              {rejected.map((p: any) => renderUser(p, false))}
            </View>
          )}
        </View>
      )}
    </View>
  );
}

function makeTabStyles(t: typeof staticTheme) {
  return StyleSheet.create({
    sectionTitle: {
      fontSize: 17, fontFamily: 'Poppins_700Bold',
      color: t.colors.textPrimary,
      marginBottom: 16,
    },
    sectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    statusRow: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 20,
    },
    statusChip: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 999,
      borderWidth: 1,
    },
    statusDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      marginRight: 6,
    },
    statusChipText: {
      fontSize: 13,
      fontFamily: 'Poppins_600SemiBold',
    },
    infoRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingVertical: 6,
      borderBottomWidth: 1,
      borderBottomColor: t.colors.border,
    },
    infoLabel: {
      fontSize: 14, fontFamily: 'Poppins_400Regular',
      color: t.colors.textSecondary,
    },
    infoValue: {
      fontSize: 14, fontFamily: 'Poppins_600SemiBold',
      color: t.colors.textPrimary,
    },
    row: {
      flexDirection: 'row',
    },
    editActions: {
      flexDirection: 'row',
      gap: 12,
      marginTop: 20,
      justifyContent: 'flex-end',
    },
    teamRow: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 12,
      borderRadius: 12,
      marginBottom: 6,
      backgroundColor: t.colors.inputBg,
      borderWidth: 1,
      borderColor: t.colors.border,
    },
    countBadge: {
      backgroundColor: t.colors.primaryLight + '22',
      borderWidth: 1,
      borderColor: t.colors.primaryLight + '55',
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 2,
      minWidth: 28,
      alignItems: 'center',
    },
    countBadgeText: {
      fontSize: 12,
      fontFamily: 'Poppins_700Bold',
      color: t.colors.primaryLight,
    },
    searchWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: t.colors.inputBg,
      borderWidth: 1,
      borderColor: t.colors.border,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: Platform.OS === 'web' ? 8 : 4,
      marginBottom: 10,
      minHeight: 44,
    },
    searchInput: {
      flex: 1,
      fontSize: 14,
      fontFamily: 'Poppins_400Regular',
      color: t.colors.textPrimary,
      paddingVertical: 0,
      ...(Platform.OS === 'web'
        ? ({ outline: 'none', border: 'none', backgroundColor: 'transparent' } as any)
        : {}),
    },
    searchResultText: {
      fontSize: 12,
      fontFamily: 'Poppins_500Medium',
      color: t.colors.textSecondary,
      marginBottom: 8,
      marginLeft: 4,
    },
    teamNumber: {
      width: 28,
      height: 28,
      borderRadius: 8,
      backgroundColor: t.colors.surface,
      borderWidth: 1,
      borderColor: t.colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 10,
    },
    teamNumberText: {
      fontSize: 12,
      fontFamily: 'Poppins_700Bold',
      color: t.colors.textSecondary,
    },
    teamRowSelected: {
      borderColor: t.colors.primaryLight,
      backgroundColor: 'rgba(0,82,204,0.1)',
    },
    teamAvatar: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: t.colors.primaryLight,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },
    teamInitial: {
      color: '#fff',
      fontSize: 16,
      fontFamily: 'Poppins_700Bold',
    },
    teamName: {
      fontSize: 14, fontFamily: 'Poppins_600SemiBold',
      color: t.colors.textPrimary,
    },
    teamCountry: {
      fontSize: 12, fontFamily: 'Poppins_400Regular',
      color: t.colors.textSecondary,
    },
    modalTitle: {
      fontSize: 20, fontFamily: 'Poppins_700Bold',
      color: t.colors.textPrimary,
      marginBottom: 20,
      textAlign: 'center',
    },
    matchdayRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    matchdayName: {
      fontSize: 14, fontFamily: 'Poppins_600SemiBold',
      color: t.colors.textPrimary,
    },
    matchdayDate: {
      fontSize: 12, fontFamily: 'Poppins_400Regular',
      color: t.colors.textSecondary,
      marginTop: 2,
    },
    poolText: {
      fontSize: 12, fontFamily: 'Poppins_400Regular',
      color: t.colors.success,
      marginTop: 4,
    },
    rankingShortcut: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      marginTop: 6,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: '#FFD70055',
      backgroundColor: '#FFD70015',
    },
    rankingShortcutText: {
      fontSize: 10,
      fontFamily: 'Poppins_700Bold',
      color: '#FFD700',
      letterSpacing: 0.3,
    },
    participantRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 6,
      borderBottomWidth: 1,
      borderBottomColor: t.colors.border,
    },
    participantName: {
      fontSize: 14, fontFamily: 'Poppins_600SemiBold',
      color: t.colors.textPrimary,
    },
    participantInfo: {
      fontSize: 12, fontFamily: 'Poppins_400Regular',
      color: t.colors.textSecondary,
      marginTop: 2,
    },
    actionChip: {
      width: 32,
      height: 32,
      borderRadius: 999,
      alignItems: 'center',
      justifyContent: 'center',
    },
    subSectionTitle: {
      fontSize: 13, fontFamily: 'Poppins_600SemiBold',
      color: t.colors.textSecondary,
      marginBottom: 6,
      marginTop: 6,
    },
    enrolledBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      padding: 12,
      marginBottom: 16,
      backgroundColor: 'rgba(16,185,129,0.1)',
      borderRadius: 12,
      borderWidth: 1,
      borderColor: 'rgba(16,185,129,0.25)',
    },
    enrolledBannerText: {
      fontSize: 13, fontFamily: 'Poppins_600SemiBold',
      color: t.colors.success,
    },
  });
}

function makeStyles(t: typeof staticTheme) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: t.colors.bg,
    },
    headerGrad: { paddingBottom: 24 },
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
    headerTitle: {
      fontSize: 22, fontFamily: 'Poppins_800ExtraBold',
      color: '#fff', letterSpacing: -0.4,
    },
    headerIcon: {
      width: 42, height: 42, borderRadius: 13,
      backgroundColor: 'rgba(255,255,255,0.12)',
      alignItems: 'center', justifyContent: 'center',
    },
    tabBar: {
      flexDirection: 'row',
      borderBottomWidth: 1,
      borderBottomColor: t.colors.border,
    },
    tab: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 12,
      gap: 4,
    },
    tabActive: {
      borderBottomWidth: 2,
      borderBottomColor: t.colors.primaryLight,
    },
    tabText: {
      fontSize: 11, fontFamily: 'Poppins_500Medium',
      color: t.colors.textMuted,
    },
    tabTextActive: {
      color: t.colors.primaryLight,
      fontFamily: 'Poppins_700Bold',
    },
    content: {
      flex: 1,
    },
    scrollContent: {
      padding: 20,
      paddingBottom: 80,
    },
  });
}
