/**
 * Torneos — Premium admin tournament management
 * Gradient cards · status pills · polished create modal
 */
import React, { useState, useMemo } from 'react';
import {
  View, Text, ScrollView, RefreshControl, Pressable,
  StyleSheet, Platform,
} from 'react-native';
import { SafeAreaView }  from 'react-native-safe-area-context';
import { Ionicons }      from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import Animated, { FadeInDown, ZoomIn } from 'react-native-reanimated';
import { Button }        from '../../components/ui/Button';
import { Input }         from '../../components/ui/Input';
import { Modal }         from '../../components/ui/Modal';
import { DateTimePicker } from '../../components/ui/DateTimePicker';
import { Skeleton }      from '../../components/ui/Skeleton';
import { EmptyState }    from '../../components/ui/EmptyState';
import { useToast }      from '../../components/ui/Toast';
import { useTheme }      from '../../contexts/ThemeContext';
import { theme as staticTheme } from '../../constants/theme';
import api from '../../services/api';
import { toLocalDateString } from '../../utils/date';

// ─── Status config ─────────────────────────────────────────────────────────────

const STATUS: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  draft:    { label: 'Borrador', color: '#F59E0B', bg: 'rgba(245,158,11,0.15)',  icon: 'create-outline' },
  active:   { label: 'Activo',   color: '#10B981', bg: 'rgba(16,185,129,0.15)',  icon: 'checkmark-circle-outline' },
  finished: { label: 'Finalizado', color: '#94A3B8', bg: 'rgba(148,163,184,0.15)', icon: 'checkmark-done-outline' },
};

const TYPE_COLORS: Record<string, { color: string; bg: string }> = {
  matchday:    { color: '#3B82F6', bg: 'rgba(59,130,246,0.15)' },
  group_stage: { color: '#A855F7', bg: 'rgba(168,85,247,0.15)' },
};

function formatDate(dateStr: string) {
  try {
    const d = new Date(dateStr);
    const day = String(d.getDate()).padStart(2, '0');
    const mo  = String(d.getMonth() + 1).padStart(2, '0');
    return `${day}/${mo}/${d.getFullYear()}`;
  } catch { return dateStr; }
}

// ─── Screen ────────────────────────────────────────────────────────────────────

export default function TorneosScreen() {
  const { theme }     = useTheme();
  const styles        = useMemo(() => makeStyles(theme), [theme]);
  const [showCreate, setShowCreate]   = useState(false);
  const [refreshing, setRefreshing]   = useState(false);
  const queryClient   = useQueryClient();

  const { data: tournaments, isLoading, refetch } = useQuery({
    queryKey: ['tournaments'],
    queryFn:  async () => (await api.get('/api/tournaments'))?.data ?? [],
  });

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <LinearGradient
        colors={[theme.colors.primary, theme.colors.primaryLight]}
        start={{ x: 0, y: 0 }} end={{ x: 0.7, y: 1 }}
        style={styles.header}
      >
        <View>
          <Text style={styles.headerTitle}>Torneos</Text>
          <Text style={styles.headerSub}>
            {tournaments?.length ?? 0} torneos registrados
          </Text>
        </View>
        <Button
          title="Nuevo torneo"
          icon="add"
          variant="primary"
          size="sm"
          onPress={() => setShowCreate(true)}
        />
      </LinearGradient>

      {/* ── List ────────────────────────────────────────────────────────── */}
      <ScrollView
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.colors.primaryLight}
          />
        }
      >
        {isLoading ? (
          [1, 2, 3].map(i => (
            <Skeleton key={i} width="100%" height={148} style={{ marginBottom: 12, borderRadius: 16 }} />
          ))
        ) : (tournaments?.length ?? 0) === 0 ? (
          <EmptyState
            icon="trophy-outline"
            title="Sin torneos todavía"
            description="Crea el primer torneo para comenzar"
            actionLabel="Crear Torneo"
            onAction={() => setShowCreate(true)}
            animated
          />
        ) : (
          tournaments?.map?.((t: any, idx: number) => (
            <Animated.View
              key={t?.id}
              entering={FadeInDown.delay(idx * 70).duration(380).springify()}
            >
              <TournamentCard
                tournament={t}
                theme={theme}
                styles={styles}
                onManage={() => router.push(`/tournament/${t?.id}` as any)}
              />
            </Animated.View>
          ))
        )}
      </ScrollView>

      {/* ── Create modal ────────────────────────────────────────────────── */}
      <CreateTournamentModal
        visible={showCreate}
        onClose={() => setShowCreate(false)}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['tournaments'] });
          setShowCreate(false);
        }}
      />
    </SafeAreaView>
  );
}

// ─── Tournament Card ───────────────────────────────────────────────────────────

function TournamentCard({
  tournament: t, theme, styles, onManage,
}: { tournament: any; theme: any; styles: any; onManage: () => void }) {
  const st   = STATUS[t?.status]   ?? STATUS.draft;
  const type = TYPE_COLORS[t?.type] ?? TYPE_COLORS.matchday;

  return (
    <Pressable onPress={onManage} style={styles.card}>
      {/* Gradient header band */}
      <LinearGradient
        colors={[theme.colors.surfaceElevated, theme.colors.surface]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
        style={styles.cardHeader}
      >
        <View style={styles.cardHeaderLeft}>
          <View style={[styles.typeChip, { backgroundColor: type.bg }]}>
            <Ionicons
              name={t?.type === 'matchday' ? 'trophy-outline' : 'people-outline'}
              size={11}
              color={type.color}
            />
            <Text style={[styles.typeChipText, { color: type.color }]}>
              {t?.type === 'matchday' ? 'Apuestas' : 'Grupos'}
            </Text>
          </View>
          <View style={[styles.statusChip, { backgroundColor: st.bg }]}>
            <Ionicons name={st.icon as any} size={11} color={st.color} />
            <Text style={[styles.statusChipText, { color: st.color }]}>{st.label}</Text>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={16} color={theme.colors.textMuted} />
      </LinearGradient>

      {/* Card body */}
      <View style={styles.cardBody}>
        <Text style={styles.cardName} numberOfLines={1}>{t?.name}</Text>

        {/* Dates */}
        <View style={styles.cardRow}>
          <Ionicons name="calendar-outline" size={13} color={theme.colors.textMuted} />
          <Text style={styles.cardMeta}>
            {formatDate(t?.start_date)} — {formatDate(t?.end_date)}
          </Text>
        </View>

        {/* Financial info */}
        <View style={styles.cardFooter}>
          <View style={styles.cardStat}>
            <Text style={styles.cardStatValue}>
              {t?.currency ?? 'Bs'} {Number(t?.bet_per_matchday ?? 0)}
            </Text>
            <Text style={styles.cardStatLabel}>por jornada</Text>
          </View>
          <View style={styles.cardStatDivider} />
          <View style={styles.cardStat}>
            <Text style={styles.cardStatValue}>
              {t?.currency ?? 'Bs'} {Number(t?.bet_final ?? 0)}
            </Text>
            <Text style={styles.cardStatLabel}>polla final</Text>
          </View>
          <View style={styles.cardStatDivider} />
          <View style={styles.cardStat}>
            {(() => {
              // Pozo total = participants × bet/jornada × jornadas
              // Backend's t.total_pool is unreliable; compute it live from real numbers.
              const participants = Number(t?._count?.participants ?? t?.participants?.length ?? 0);
              const matchdays    = Number(t?._count?.matchdays    ?? t?.matchdays?.length    ?? 0);
              const bet          = Number(t?.bet_per_matchday ?? 0);
              const computedPool = participants * matchdays * bet;
              // Prefer backend's stored value ONLY if it's already greater (e.g. when
              // the backend properly tracks accumulated pool).
              const pool = Math.max(computedPool, Number(t?.total_pool ?? 0));
              return (
                <Text style={[styles.cardStatValue, { color: theme.colors.gold }]}>
                  {t?.currency ?? 'Bs'} {pool}
                </Text>
              );
            })()}
            <Text style={styles.cardStatLabel}>pozo total</Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

// ─── Create Tournament Modal ───────────────────────────────────────────────────

function CreateTournamentModal({
  visible, onClose, onSuccess,
}: { visible: boolean; onClose: () => void; onSuccess: () => void }) {
  const { theme }     = useTheme();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name:               '',
    description:        '',
    type:               'matchday' as 'matchday' | 'group_stage',
    start_date:         null as Date | null,
    end_date:           null as Date | null,
    bet_per_matchday:   '10',
    bet_final:          '5',
    currency:           'Bs',
    final_bet_deadline: null as Date | null,
  });

  const set = (key: string, val: any) => setForm(f => ({ ...f, [key]: val }));

  const handleCreate = async () => {
    if (!form.name?.trim())               { showToast('error', 'El nombre es obligatorio');   return; }
    if (!form.start_date || !form.end_date) { showToast('error', 'Las fechas son obligatorias'); return; }

    setLoading(true);
    try {
      await api.post('/api/tournaments', {
        name:             form.name.trim(),
        description:      form.description?.trim() || undefined,
        type:             form.type,
        // Use LOCAL calendar day, not UTC — avoids timezone off-by-one shift
        start_date:       toLocalDateString(form.start_date),
        end_date:         toLocalDateString(form.end_date),
        bet_per_matchday: Number(form.bet_per_matchday) || 10,
        bet_final:        Number(form.bet_final) || 5,
        currency:         form.currency || 'Bs',
        ...(form.final_bet_deadline
          ? { final_bet_deadline: form.final_bet_deadline.toISOString() }
          : {}),
      });
      // Await onSuccess (que normalmente hace refetch del padre) ANTES
      // del toast → la lista nueva se ve apenas se cierre el modal.
      await Promise.resolve(onSuccess());
      showToast('success', '¡Torneo creado! 🏆');
      setForm({ name: '', description: '', type: 'matchday', start_date: null,
                end_date: null, bet_per_matchday: '10', bet_final: '5',
                currency: 'Bs', final_bet_deadline: null });
    } catch (error: any) {
      showToast('error', error?.friendlyMessage || 'Error al crear torneo');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} onClose={onClose}>
      <ScrollView showsVerticalScrollIndicator={false}>

        {/* Modal header */}
        <View style={{ alignItems: 'center', marginBottom: 24 }}>
          <View style={{
            width: 48, height: 48, borderRadius: 14,
            backgroundColor: theme.colors.primary + '20',
            alignItems: 'center', justifyContent: 'center', marginBottom: 12,
          }}>
            <Ionicons name="trophy" size={24} color={theme.colors.primaryLight} />
          </View>
          <Text style={{
            fontSize: 20, fontWeight: '700', color: theme.colors.textPrimary,
            fontFamily: 'Poppins_700Bold', letterSpacing: -0.3,
          }}>
            Nuevo Torneo
          </Text>
          <Text style={{
            fontSize: 12, color: theme.colors.textMuted,
            fontFamily: 'Poppins_400Regular', marginTop: 3,
          }}>
            Configura los parámetros del torneo
          </Text>
        </View>

        {/* ── Section: Info básica ─────────────────────────────────────── */}
        <SectionLabel theme={theme} title="Información básica" icon="information-circle-outline" />

        <Input
          label="Nombre del torneo *"
          value={form.name}
          onChangeText={v => set('name', v)}
          placeholder="Ej: Mundial 2026 – Fase de Grupos"
          icon="trophy-outline"
        />
        <Input
          label="Descripción"
          value={form.description}
          onChangeText={v => set('description', v)}
          placeholder="Descripción opcional..."
          multiline
          numberOfLines={2}
        />

        {/* ── Section: Fechas ──────────────────────────────────────────── */}
        <SectionLabel theme={theme} title="Fechas del torneo" icon="calendar-outline" />

        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <DateTimePicker
              label="Fecha inicio *"
              value={form.start_date}
              onChange={d => set('start_date', d)}
              mode="date"
              minimumDate={new Date('2025-01-01')}
            />
          </View>
          <View style={{ flex: 1 }}>
            <DateTimePicker
              label="Fecha fin *"
              value={form.end_date}
              onChange={d => set('end_date', d)}
              mode="date"
              minimumDate={form.start_date ?? new Date('2025-01-01')}
            />
          </View>
        </View>

        <DateTimePicker
          label="Límite Polla Final (opcional)"
          value={form.final_bet_deadline}
          onChange={d => set('final_bet_deadline', d)}
          mode="datetime"
          minimumDate={new Date()}
        />

        {/* ── Section: Montos ──────────────────────────────────────────── */}
        <SectionLabel theme={theme} title="Montos de apuesta" icon="cash-outline" />

        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Input
              label="Por jornada"
              value={form.bet_per_matchday}
              onChangeText={v => set('bet_per_matchday', v)}
              type="number"
              icon="ticket-outline"
              hint="Costo por jornada"
            />
          </View>
          <View style={{ flex: 1 }}>
            <Input
              label="Polla final"
              value={form.bet_final}
              onChangeText={v => set('bet_final', v)}
              type="number"
              icon="star-outline"
              hint="Costo polla final"
            />
          </View>
        </View>

        <Input
          label="Moneda"
          value={form.currency}
          onChangeText={v => set('currency', v)}
          placeholder="Bs"
          icon="card-outline"
          hint="Ej: Bs, USD, EUR"
        />

        {/* ── Actions ──────────────────────────────────────────────────── */}
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
          <Button
            title="Cancelar"
            variant="outline"
            size="md"
            onPress={onClose}
            style={{ flex: 1 }}
          />
          <Button
            title="Crear Torneo"
            variant="primary"
            size="md"
            onPress={handleCreate}
            loading={loading}
            icon="checkmark"
            style={{ flex: 1 }}
          />
        </View>

      </ScrollView>
    </Modal>
  );
}

// ─── Section label ────────────────────────────────────────────────────────────

function SectionLabel({ theme, title, icon }: { theme: any; title: string; icon: string }) {
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', gap: 6,
      marginBottom: 10, marginTop: 4,
    }}>
      <Ionicons name={icon as any} size={13} color={theme.colors.primaryLight} />
      <Text style={{
        fontSize: 11, fontWeight: '700', color: theme.colors.primaryLight,
        fontFamily: 'Poppins_700Bold', letterSpacing: 0.8, textTransform: 'uppercase',
      }}>
        {title}
      </Text>
      <View style={{ flex: 1, height: 1, backgroundColor: theme.colors.border, marginLeft: 4 }} />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

function makeStyles(t: typeof staticTheme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: t.colors.bg },

    header: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      paddingHorizontal: 20, paddingTop: 14, paddingBottom: 22,
    },
    headerTitle: { fontSize: 22, fontFamily: 'Poppins_800ExtraBold', color: '#fff', letterSpacing: -0.4 },
    headerSub: { fontSize: 12, fontFamily: 'Poppins_400Regular', color: 'rgba(255,255,255,0.6)', marginTop: 2 },

    list: { padding: 20, paddingBottom: 80, gap: 14 },

    card: {
      backgroundColor: t.colors.surface, borderRadius: 16,
      borderWidth: StyleSheet.hairlineWidth, borderColor: t.colors.border,
      overflow: 'hidden',
      shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.18, shadowRadius: 10, elevation: 5,
    },
    cardHeader: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 14, paddingVertical: 10,
      borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.colors.border,
    },
    cardHeaderLeft: { flexDirection: 'row', gap: 8 },
    typeChip: {
      flexDirection: 'row', alignItems: 'center', gap: 4,
      paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999,
    },
    typeChipText: { fontSize: 10, fontFamily: 'Poppins_700Bold' },
    statusChip: {
      flexDirection: 'row', alignItems: 'center', gap: 4,
      paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999,
    },
    statusChipText: { fontSize: 10, fontFamily: 'Poppins_700Bold' },
    cardBody: { padding: 14 },
    cardName: { fontSize: 17, fontFamily: 'Poppins_700Bold', color: t.colors.textPrimary, marginBottom: 6 },
    cardRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 12 },
    cardMeta: { fontSize: 12, fontFamily: 'Poppins_400Regular', color: t.colors.textMuted },
    cardFooter: {
      flexDirection: 'row', alignItems: 'center',
      paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.colors.border,
    },
    cardStat: { flex: 1, alignItems: 'center' },
    cardStatValue: { fontSize: 13, fontFamily: 'Poppins_700Bold', color: t.colors.textPrimary },
    cardStatLabel: { fontSize: 9, fontFamily: 'Poppins_400Regular', color: t.colors.textMuted, marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.5 },
    cardStatDivider: { width: StyleSheet.hairlineWidth, height: 28, backgroundColor: t.colors.border },
  });
}
