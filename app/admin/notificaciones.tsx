/**
 * Admin → Notificaciones
 *
 *  Tab "Enviar"     : envío manual ahora (a todos o a uno)
 *  Tab "Programadas": CRUD de notification_schedule (pre_match / cron)
 *  Tab "Stats"      : tokens por plataforma, conectados, últimos avisos
 */
import React, { useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, Pressable, Switch, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useFocusEffect } from '@react-navigation/native';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Skeleton } from '../../components/ui/Skeleton';
import { Modal } from '../../components/ui/Modal';
import { useToast } from '../../components/ui/Toast';
import { useTheme } from '../../contexts/ThemeContext';
import api from '../../services/api';

type Tab = 'send' | 'schedules' | 'stats';

export default function AdminNotificationsScreen() {
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const [tab, setTab] = useState<Tab>('send');

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <LinearGradient
        colors={[theme.colors.primary, theme.colors.primaryLight]}
        start={{ x: 0, y: 0 }} end={{ x: 0.6, y: 1 }}
        style={styles.header}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={styles.headIcon}>
            <Ionicons name="notifications" size={20} color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Notificaciones</Text>
            <Text style={styles.subtitle}>Push manual, programadas y stats</Text>
          </View>
        </View>
      </LinearGradient>

      {/* Tabs */}
      <View style={[styles.tabBar, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
        {([
          { k: 'send',      label: 'Enviar',      icon: 'send' as const },
          { k: 'schedules', label: 'Programadas', icon: 'time' as const },
          { k: 'stats',     label: 'Stats',       icon: 'stats-chart' as const },
        ] as const).map(t => (
          <Pressable key={t.k} style={[styles.tab, tab === t.k && { borderBottomColor: theme.colors.primaryLight }]} onPress={() => setTab(t.k as Tab)}>
            <Ionicons name={t.icon} size={14} color={tab === t.k ? theme.colors.primaryLight : theme.colors.textMuted} />
            <Text style={[styles.tabText, { color: tab === t.k ? theme.colors.primaryLight : theme.colors.textMuted }]}>{t.label}</Text>
          </Pressable>
        ))}
      </View>

      {tab === 'send'      && <TabSend     theme={theme} styles={styles} />}
      {tab === 'schedules' && <TabSchedules theme={theme} styles={styles} />}
      {tab === 'stats'     && <TabStats     theme={theme} styles={styles} />}
    </SafeAreaView>
  );
}

// ════════════════════════════════════════════════════════════════════════
//  Tab "Enviar"
// ════════════════════════════════════════════════════════════════════════
function TabSend({ theme, styles }: any) {
  const { showToast } = useToast();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');

  const broadcast = useMutation({
    mutationFn: async () => (await api.post('/api/admin/notifications/broadcast', { title, body }))?.data,
    onSuccess: (res: any) => {
      showToast('success', `Enviado a ${res?.sent ?? 0}/${res?.total ?? 0} dispositivos`);
      setTitle(''); setBody('');
    },
    onError: (e: any) => showToast('error', e?.response?.data?.message ?? 'Error'),
  });

  const canSend = title.trim() && body.trim();

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Card style={styles.card}>
        <Text style={styles.label}>Título</Text>
        <TextInput
          value={title} onChangeText={setTitle}
          placeholder='Ej. "Empezó la jornada"'
          placeholderTextColor={theme.colors.textMuted}
          style={styles.input} maxLength={60}
        />
        <Text style={styles.hint}>{title.length}/60</Text>

        <Text style={[styles.label, { marginTop: 12 }]}>Mensaje</Text>
        <TextInput
          value={body} onChangeText={setBody}
          placeholder="Texto que verá el usuario"
          placeholderTextColor={theme.colors.textMuted}
          style={[styles.input, { height: 80 }]} multiline maxLength={180}
        />
        <Text style={styles.hint}>{body.length}/180</Text>

        <View style={{ height: 14 }} />
        <Button
          title={broadcast.isPending ? 'Enviando…' : '📣 Enviar a TODOS ahora'}
          onPress={() => broadcast.mutate()}
          disabled={!canSend || broadcast.isPending}
        />
      </Card>
    </ScrollView>
  );
}

// ════════════════════════════════════════════════════════════════════════
//  Tab "Programadas"
// ════════════════════════════════════════════════════════════════════════
function TabSchedules({ theme, styles }: any) {
  const qc = useQueryClient();
  const { showToast } = useToast();
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<any>(null);

  const { data: schedules, isLoading, refetch } = useQuery({
    queryKey: ['admin-notification-schedules'],
    queryFn: async () => (await api.get('/api/admin/notifications/schedules'))?.data ?? [],
  });

  useFocusEffect(React.useCallback(() => { refetch(); }, [refetch]));

  const toggle = useMutation({
    mutationFn: async ({ id, enabled }: any) =>
      (await api.post(`/api/admin/notifications/schedules/${id}/toggle`, { enabled }))?.data,
    onSuccess: (_data, vars: any) => {
      qc.invalidateQueries({ queryKey: ['admin-notification-schedules'] });
      showToast('success', vars?.enabled ? 'Programación activada' : 'Programación pausada');
    },
    onError: (e: any) =>
      showToast('error', e?.response?.data?.message || 'Error al cambiar estado'),
  });

  const remove = useMutation({
    mutationFn: async (id: string) =>
      (await api.delete(`/api/admin/notifications/schedules/${id}`))?.data,
    onSuccess: () => {
      showToast('success', 'Programación eliminada');
      qc.invalidateQueries({ queryKey: ['admin-notification-schedules'] });
    },
    onError: (e: any) =>
      showToast('error', e?.response?.data?.message || 'Error al eliminar'),
  });

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={false} onRefresh={() => refetch()} tintColor={theme.colors.primaryLight} />}
    >
      <Pressable
        style={[styles.addBtn, { backgroundColor: theme.colors.primaryLight }]}
        onPress={() => { setEditing(null); setShowModal(true); }}
      >
        <Ionicons name="add-circle" size={20} color="#fff" />
        <Text style={styles.addBtnText}>Nueva programación</Text>
      </Pressable>

      {isLoading ? (
        [1, 2].map(i => <Skeleton key={i} width="100%" height={100} style={{ marginBottom: 10 }} />)
      ) : (schedules ?? []).length === 0 ? (
        <View style={{ alignItems: 'center', paddingVertical: 50 }}>
          <Ionicons name="time-outline" size={48} color={theme.colors.textMuted} />
          <Text style={{ color: theme.colors.textSecondary, marginTop: 10, fontFamily: 'Poppins_500Medium' }}>
            Sin programaciones. Crea una para empezar.
          </Text>
        </View>
      ) : (
        (schedules ?? []).map((s: any) => (
          <Card key={s.id} style={[styles.card, { padding: 12 }]}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
              <View style={[styles.scheduleIcon, {
                backgroundColor: s.kind === 'pre_match' ? '#10B98120' : '#3B82F620',
              }]}>
                <Ionicons
                  name={s.kind === 'pre_match' ? 'football' : 'time'}
                  size={18}
                  color={s.kind === 'pre_match' ? '#10B981' : '#3B82F6'}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.scheduleName, { color: theme.colors.textPrimary }]}>{s.name}</Text>
                <Text style={[styles.scheduleSub, { color: theme.colors.textMuted }]}>
                  {s.kind === 'pre_match'
                    ? `${s.offset_minutes} min antes de cada partido · target: ${s.target}`
                    : `Cron: ${s.cron_expr} · target: ${s.target}`}
                </Text>
                {s.last_run_at && (
                  <Text style={[styles.scheduleSub, { color: theme.colors.textMuted, marginTop: 2 }]}>
                    Última: {new Date(s.last_run_at).toLocaleString()} · enviado a {s.last_sent_count ?? 0}
                  </Text>
                )}
              </View>
              <Switch
                value={s.enabled}
                onValueChange={(v) => toggle.mutate({ id: s.id, enabled: v })}
                trackColor={{ false: theme.colors.border, true: '#10B981' }}
                thumbColor="#fff"
              />
            </View>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
              <Pressable
                style={[styles.actionBtn, { borderColor: theme.colors.primaryLight }]}
                onPress={() => { setEditing(s); setShowModal(true); }}
              >
                <Ionicons name="create" size={16} color={theme.colors.primaryLight} />
                <Text style={[styles.actionText, { color: theme.colors.primaryLight }]}>Editar</Text>
              </Pressable>
              <Pressable
                style={[styles.actionBtn, { borderColor: '#EF4444' }]}
                onPress={() => remove.mutate(s.id)}
              >
                <Ionicons name="trash" size={16} color="#EF4444" />
                <Text style={[styles.actionText, { color: '#EF4444' }]}>Eliminar</Text>
              </Pressable>
            </View>
          </Card>
        ))
      )}

      {showModal && (
        <ScheduleFormModal
          theme={theme}
          editing={editing}
          onClose={() => setShowModal(false)}
          onSaved={() => {
            setShowModal(false);
            qc.invalidateQueries({ queryKey: ['admin-notification-schedules'] });
          }}
        />
      )}
    </ScrollView>
  );
}

// ── Modal de creación/edición ──────────────────────────────────────────
function ScheduleFormModal({ theme, editing, onClose, onSaved }: any) {
  const { showToast } = useToast();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const isEdit = !!editing;

  const [name, setName]   = useState(editing?.name ?? '');
  const [kind, setKind]   = useState<'pre_match' | 'cron'>(editing?.kind ?? 'pre_match');
  const [offset, setOffset] = useState(String(editing?.offset_minutes ?? 60));
  const [cronExpr, setCronExpr] = useState(editing?.cron_expr ?? '0 9 * * *');
  const [title, setTitle] = useState(editing?.title ?? '⚽ ¡Apuesta antes que empiece!');
  const [body, setBody]   = useState(editing?.body ?? 'El partido {team_a} vs {team_b} empieza en {minutes} min. No olvides apostar.');
  const [target, setTarget] = useState<'all' | 'non_bettors' | 'tournament_participants'>(editing?.target ?? 'non_bettors');

  const save = useMutation({
    mutationFn: async () => {
      const dto: any = {
        name, kind, title, body, target,
        offset_minutes: kind === 'pre_match' ? parseInt(offset, 10) : null,
        cron_expr: kind === 'cron' ? cronExpr : null,
        enabled: true,
      };
      if (isEdit) {
        return (await api.patch(`/api/admin/notifications/schedules/${editing.id}`, dto))?.data;
      }
      return (await api.post('/api/admin/notifications/schedules', dto))?.data;
    },
    onSuccess: () => {
      showToast('success', isEdit ? 'Actualizada' : 'Programación creada');
      onSaved();
    },
    onError: (e: any) => showToast('error', e?.response?.data?.message ?? 'Error'),
  });

  const targetOptions = [
    {
      value: 'non_bettors' as const,
      icon: 'alert-circle' as const,
      color: '#F59E0B',
      title: 'Solo los que NO apostaron',
      desc: 'Recomendado. Avisa solo a quien aún no hizo su quiniela.',
    },
    {
      value: 'tournament_participants' as const,
      icon: 'people' as const,
      color: '#3B82F6',
      title: 'Inscritos del torneo',
      desc: 'Todos los que están en el torneo, hayan apostado o no.',
    },
    {
      value: 'all' as const,
      icon: 'megaphone' as const,
      color: '#8B5CF6',
      title: 'Todos los usuarios',
      desc: 'Broadcast a cualquiera con la app instalada.',
    },
  ];

  return (
    <Modal visible onClose={onClose} title={isEdit ? 'Editar programación' : 'Nueva programación'}>
      <ScrollView
        style={{ maxHeight: 560 }}
        contentContainerStyle={{ paddingBottom: 8 }}
        showsVerticalScrollIndicator
      >
        {/* ── Nombre ─────────────────────────────────────────── */}
        <Text style={styles.label}>Nombre interno</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          style={styles.input}
          placeholder='Ej. "Recordatorio 1h antes"'
          placeholderTextColor={theme.colors.textMuted}
        />

        {/* ── Tipo (cards horizontales) ──────────────────────── */}
        <Text style={[styles.label, { marginTop: 16 }]}>Tipo</Text>
        <View style={modalStyles.row2}>
          <Pressable
            style={[
              modalStyles.bigCard,
              kind === 'pre_match' && { backgroundColor: '#10B98115', borderColor: '#10B981' },
              { borderColor: kind === 'pre_match' ? '#10B981' : theme.colors.border },
            ]}
            onPress={() => setKind('pre_match')}
          >
            <Ionicons name="football" size={20} color={kind === 'pre_match' ? '#10B981' : theme.colors.textMuted} />
            <Text style={[modalStyles.bigCardTitle, { color: kind === 'pre_match' ? '#10B981' : theme.colors.textPrimary }]}>
              Antes de cada partido
            </Text>
            <Text style={[modalStyles.bigCardDesc, { color: theme.colors.textMuted }]}>
              N minutos antes del kickoff
            </Text>
          </Pressable>
          <Pressable
            style={[
              modalStyles.bigCard,
              kind === 'cron' && { backgroundColor: '#3B82F615', borderColor: '#3B82F6' },
              { borderColor: kind === 'cron' ? '#3B82F6' : theme.colors.border },
            ]}
            onPress={() => setKind('cron')}
          >
            <Ionicons name="time" size={20} color={kind === 'cron' ? '#3B82F6' : theme.colors.textMuted} />
            <Text style={[modalStyles.bigCardTitle, { color: kind === 'cron' ? '#3B82F6' : theme.colors.textPrimary }]}>
              Hora fija (cron)
            </Text>
            <Text style={[modalStyles.bigCardDesc, { color: theme.colors.textMuted }]}>
              Diario / semanal / custom
            </Text>
          </Pressable>
        </View>

        {/* ── Offset / Cron ──────────────────────────────────── */}
        {kind === 'pre_match' ? (
          <>
            <Text style={[styles.label, { marginTop: 16 }]}>Minutos antes del partido</Text>
            <TextInput
              value={offset}
              onChangeText={setOffset}
              keyboardType="numeric"
              style={styles.input}
              placeholder="60"
              placeholderTextColor={theme.colors.textMuted}
            />
            <View style={modalStyles.quickRow}>
              {[15, 30, 60, 1440].map((m) => (
                <Pressable
                  key={m}
                  onPress={() => setOffset(String(m))}
                  style={[
                    modalStyles.quickChip,
                    Number(offset) === m && { backgroundColor: '#10B98120', borderColor: '#10B981' },
                  ]}
                >
                  <Text
                    style={[
                      modalStyles.quickChipText,
                      { color: Number(offset) === m ? '#10B981' : theme.colors.textSecondary },
                    ]}
                  >
                    {m === 1440 ? '1 día' : m < 60 ? `${m} min` : `${m / 60}h`}
                  </Text>
                </Pressable>
              ))}
            </View>
          </>
        ) : (
          <>
            <Text style={[styles.label, { marginTop: 16 }]}>Expresión cron</Text>
            <TextInput
              value={cronExpr}
              onChangeText={setCronExpr}
              style={styles.input}
              placeholder="0 9 * * *"
              placeholderTextColor={theme.colors.textMuted}
            />
            <Text style={styles.hint}>
              "0 9 * * *" = 9 AM diario · "0 */6 * * *" = cada 6h · "0 18 * * 5" = viernes 6 PM
            </Text>
          </>
        )}

        {/* ── Destinatarios (cards verticales) ───────────────── */}
        <Text style={[styles.label, { marginTop: 16 }]}>Destinatarios</Text>
        <View style={{ gap: 8 }}>
          {targetOptions.map((opt) => {
            const active = target === opt.value;
            return (
              <Pressable
                key={opt.value}
                onPress={() => setTarget(opt.value)}
                style={[
                  modalStyles.targetCard,
                  {
                    borderColor: active ? opt.color : theme.colors.border,
                    backgroundColor: active ? opt.color + '12' : 'transparent',
                  },
                ]}
              >
                <View style={[modalStyles.targetIcon, { backgroundColor: opt.color + '25' }]}>
                  <Ionicons name={opt.icon} size={18} color={opt.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[modalStyles.targetTitle, { color: active ? opt.color : theme.colors.textPrimary }]}>
                    {opt.title}
                  </Text>
                  <Text style={[modalStyles.targetDesc, { color: theme.colors.textMuted }]}>
                    {opt.desc}
                  </Text>
                </View>
                {active && (
                  <Ionicons name="checkmark-circle" size={22} color={opt.color} />
                )}
              </Pressable>
            );
          })}
        </View>

        {/* ── Título / Mensaje ──────────────────────────────── */}
        <Text style={[styles.label, { marginTop: 16 }]}>Título</Text>
        <TextInput
          value={title}
          onChangeText={setTitle}
          style={styles.input}
          maxLength={60}
          placeholder='Ej. "⚽ ¡No te olvides!"'
          placeholderTextColor={theme.colors.textMuted}
        />
        <Text style={styles.hint}>{title.length}/60</Text>

        <Text style={[styles.label, { marginTop: 12 }]}>Mensaje</Text>
        <TextInput
          value={body}
          onChangeText={setBody}
          style={[styles.input, { height: 90, textAlignVertical: 'top' }]}
          multiline
          maxLength={180}
          placeholderTextColor={theme.colors.textMuted}
        />
        <Text style={styles.hint}>{body.length}/180</Text>

        {/* ── Variables disponibles ─────────────────────────── */}
        <View style={[modalStyles.varsBox, { backgroundColor: theme.colors.primaryLight + '0F', borderColor: theme.colors.primaryLight + '40' }]}>
          <Ionicons name="code-slash" size={14} color={theme.colors.primaryLight} />
          <Text style={[modalStyles.varsText, { color: theme.colors.textSecondary }]}>
            Variables: <Text style={modalStyles.varCode}>{'{team_a}'}</Text>{' '}
            <Text style={modalStyles.varCode}>{'{team_b}'}</Text>{' '}
            <Text style={modalStyles.varCode}>{'{minutes}'}</Text>{' '}
            <Text style={modalStyles.varCode}>{'{matchday}'}</Text>
          </Text>
        </View>

        {/* ── Preview ───────────────────────────────────────── */}
        <View style={[modalStyles.preview, { backgroundColor: theme.colors.surfaceElevated, borderColor: theme.colors.border }]}>
          <Text style={[modalStyles.previewLabel, { color: theme.colors.textMuted }]}>VISTA PREVIA</Text>
          <View style={modalStyles.previewBubble}>
            <View style={modalStyles.previewIcon}>
              <Text style={{ fontSize: 16 }}>⚽</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={modalStyles.previewTitle} numberOfLines={1}>{title || 'Título…'}</Text>
              <Text style={modalStyles.previewBody} numberOfLines={3}>
                {body
                  ? body.replace(/\{team_a\}/g, 'Brasil').replace(/\{team_b\}/g, 'Argentina').replace(/\{minutes\}/g, offset).replace(/\{matchday\}/g, 'J1')
                  : 'Mensaje…'}
              </Text>
              <Text style={modalStyles.previewMeta}>Mundial 2026 · ahora</Text>
            </View>
          </View>
        </View>

        <View style={{ height: 18 }} />
        <Button
          title={save.isPending ? 'Guardando…' : (isEdit ? 'Guardar cambios' : 'Crear programación')}
          onPress={() => save.mutate()}
          disabled={!name.trim() || !title.trim() || !body.trim() || save.isPending}
        />
      </ScrollView>
    </Modal>
  );
}

// ── Estilos solo del modal ─────────────────────────────────────────────
const modalStyles = StyleSheet.create({
  row2: {
    flexDirection: 'row',
    gap: 10,
  },
  bigCard: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'flex-start',
    gap: 6,
    minHeight: 86,
  },
  bigCardTitle: {
    fontSize: 13,
    fontFamily: 'Poppins_700Bold',
    letterSpacing: -0.2,
  },
  bigCardDesc: {
    fontSize: 10.5,
    fontFamily: 'Poppins_400Regular',
    lineHeight: 14,
  },
  quickRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  quickChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(120,120,120,0.3)',
  },
  quickChipText: {
    fontSize: 11,
    fontFamily: 'Poppins_700Bold',
  },
  targetCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  targetIcon: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  targetTitle: {
    fontSize: 13,
    fontFamily: 'Poppins_700Bold',
    letterSpacing: -0.2,
  },
  targetDesc: {
    fontSize: 11,
    fontFamily: 'Poppins_400Regular',
    marginTop: 2,
    lineHeight: 14,
  },
  varsBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 8,
  },
  varsText: {
    flex: 1,
    fontSize: 11,
    fontFamily: 'Poppins_400Regular',
    lineHeight: 16,
  },
  varCode: {
    fontFamily: 'Poppins_700Bold',
    color: '#10B981',
    fontSize: 10.5,
  },
  preview: {
    marginTop: 16,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  previewLabel: {
    fontSize: 9.5,
    fontFamily: 'Poppins_700Bold',
    letterSpacing: 1.2,
    marginBottom: 8,
  },
  previewBubble: {
    flexDirection: 'row',
    gap: 10,
    padding: 10,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 10,
  },
  previewIcon: {
    width: 32, height: 32, borderRadius: 8,
    backgroundColor: '#FFD70025',
    alignItems: 'center', justifyContent: 'center',
  },
  previewTitle: {
    fontSize: 12.5,
    fontFamily: 'Poppins_700Bold',
    color: '#fff',
    letterSpacing: -0.2,
  },
  previewBody: {
    fontSize: 11.5,
    fontFamily: 'Poppins_400Regular',
    color: 'rgba(255,255,255,0.75)',
    marginTop: 2,
    lineHeight: 15,
  },
  previewMeta: {
    fontSize: 9.5,
    fontFamily: 'Poppins_500Medium',
    color: 'rgba(255,255,255,0.45)',
    marginTop: 4,
  },
});

// ════════════════════════════════════════════════════════════════════════
//  Tab "Stats"
// ════════════════════════════════════════════════════════════════════════
function TabStats({ theme, styles }: any) {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['admin-notification-stats'],
    queryFn: async () => (await api.get('/api/admin/notifications/stats'))?.data ?? null,
    refetchInterval: 30_000,
  });

  useFocusEffect(React.useCallback(() => { refetch(); }, [refetch]));

  if (isLoading) {
    return <View style={styles.content}>
      {[1,2,3].map(i => <Skeleton key={i} width="100%" height={80} style={{ marginBottom: 12 }} />)}
    </View>;
  }

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={false} onRefresh={() => refetch()} tintColor={theme.colors.primaryLight} />}
    >
      {/* Conectados */}
      <Card style={[styles.card, { padding: 14 }]}>
        <Text style={[styles.sectionTitle, { color: theme.colors.textPrimary }]}>👥 Usuarios conectados</Text>
        <View style={{ flexDirection: 'row', gap: 12, marginTop: 10 }}>
          <View style={[styles.statBox, { backgroundColor: '#10B98115', borderColor: '#10B98140' }]}>
            <Text style={[styles.statValue, { color: '#10B981' }]}>{data?.users?.connected_5m ?? 0}</Text>
            <Text style={styles.statLabel}>activos ahora (5 min)</Text>
          </View>
          <View style={[styles.statBox, { backgroundColor: '#3B82F615', borderColor: '#3B82F640' }]}>
            <Text style={[styles.statValue, { color: '#3B82F6' }]}>{data?.users?.connected_1h ?? 0}</Text>
            <Text style={styles.statLabel}>última hora</Text>
          </View>
          <View style={[styles.statBox, { backgroundColor: theme.colors.inputBg, borderColor: theme.colors.border }]}>
            <Text style={[styles.statValue, { color: theme.colors.textPrimary }]}>{data?.users?.total_active ?? 0}</Text>
            <Text style={styles.statLabel}>total activos</Text>
          </View>
        </View>
      </Card>

      {/* Tokens */}
      <Card style={[styles.card, { padding: 14 }]}>
        <Text style={[styles.sectionTitle, { color: theme.colors.textPrimary }]}>📱 Dispositivos registrados</Text>
        <Text style={[styles.statSubtle, { color: theme.colors.textSecondary }]}>
          Total: <Text style={{ fontFamily: 'Poppins_700Bold' }}>{data?.tokens?.total ?? 0}</Text>
        </Text>
        <View style={{ marginTop: 10, gap: 6 }}>
          {(data?.tokens?.byType ?? []).map((t: any) => (
            <View key={t.device_type} style={styles.tokenRow}>
              <Ionicons
                name={t.device_type === 'web' ? 'globe' : t.device_type === 'android' ? 'logo-android' : t.device_type === 'ios' ? 'logo-apple' : 'phone-portrait'}
                size={16}
                color={theme.colors.primaryLight}
              />
              <Text style={[styles.tokenLabel, { color: theme.colors.textPrimary }]}>{t.device_type}</Text>
              <Text style={[styles.tokenValue, { color: theme.colors.textSecondary }]}>{t.count}</Text>
            </View>
          ))}
        </View>
      </Card>

      {/* Últimas ejecuciones de schedules */}
      {(data?.lastSchedules?.length ?? 0) > 0 && (
        <Card style={[styles.card, { padding: 14 }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.textPrimary }]}>⏰ Últimas programaciones ejecutadas</Text>
          <View style={{ marginTop: 8, gap: 8 }}>
            {(data?.lastSchedules ?? []).map((s: any) => (
              <View key={s.id} style={styles.historyRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.historyName, { color: theme.colors.textPrimary }]}>{s.name}</Text>
                  <Text style={[styles.historyDate, { color: theme.colors.textMuted }]}>
                    {new Date(s.last_run_at).toLocaleString()} · {s.kind}
                  </Text>
                </View>
                <View style={[styles.historyBadge, { backgroundColor: '#10B98115' }]}>
                  <Text style={{ color: '#10B981', fontSize: 11, fontFamily: 'Poppins_700Bold' }}>
                    {s.last_sent_count ?? 0} envíos
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </Card>
      )}

      {/* Últimos avisos pre-match */}
      {(data?.lastReminders?.length ?? 0) > 0 && (
        <Card style={[styles.card, { padding: 14 }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.textPrimary }]}>📨 Últimos recordatorios pre-partido</Text>
          <View style={{ marginTop: 8, gap: 6 }}>
            {(data?.lastReminders ?? []).map((r: any, i: number) => (
              <View key={i} style={styles.historyRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.historyName, { color: theme.colors.textPrimary }]}>{r?.schedule?.name ?? 'Schedule'}</Text>
                  <Text style={[styles.historyDate, { color: theme.colors.textMuted }]}>
                    {new Date(r.sent_at).toLocaleString()}
                  </Text>
                </View>
                <Text style={[styles.historyBadge, { color: theme.colors.textSecondary, fontSize: 11, fontFamily: 'Poppins_500Medium' }]}>
                  {r.sent_count} envíos
                </Text>
              </View>
            ))}
          </View>
        </Card>
      )}
    </ScrollView>
  );
}

// ════════════════════════════════════════════════════════════════════════
//  Styles
// ════════════════════════════════════════════════════════════════════════
function makeStyles(t: any) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: t.colors.bg },
    header:    { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 22 },
    headIcon:  { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
    title:     { fontSize: 20, fontFamily: 'Poppins_700Bold', color: '#fff', letterSpacing: -0.3 },
    subtitle:  { fontSize: 12, fontFamily: 'Poppins_400Regular', color: 'rgba(255,255,255,0.6)', marginTop: 2 },

    tabBar: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth },
    tab:    { flex: 1, flexDirection: 'row', gap: 5, alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderBottomWidth: 3, borderBottomColor: 'transparent' },
    tabText:{ fontSize: 12, fontFamily: 'Poppins_700Bold' },

    content: { padding: 16, paddingBottom: 100, gap: 12 },
    card:    { marginBottom: 0 },
    label:   { fontSize: 12, fontFamily: 'Poppins_700Bold', color: t.colors.textPrimary, marginBottom: 6 },
    input: {
      backgroundColor: t.colors.inputBg,
      borderRadius: 10, borderWidth: 1, borderColor: t.colors.border,
      paddingHorizontal: 12, paddingVertical: 10,
      color: t.colors.textPrimary, fontFamily: 'Poppins_400Regular', fontSize: 14,
    },
    hint: { fontSize: 10, fontFamily: 'Poppins_400Regular', color: t.colors.textMuted, marginTop: 4 },

    // Schedules
    addBtn:    { flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', padding: 12, borderRadius: 10, marginBottom: 6 },
    addBtnText:{ color: '#fff', fontFamily: 'Poppins_700Bold', fontSize: 13 },
    scheduleIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    scheduleName: { fontSize: 14, fontFamily: 'Poppins_700Bold' },
    scheduleSub:  { fontSize: 11, fontFamily: 'Poppins_400Regular', marginTop: 2 },
    actionBtn:    { flex: 1, flexDirection: 'row', gap: 4, alignItems: 'center', justifyContent: 'center', paddingVertical: 8, borderRadius: 8, borderWidth: 1 },
    actionText:   { fontSize: 12, fontFamily: 'Poppins_700Bold' },
    kindBtn: {
      flex: 1, flexDirection: 'row', gap: 4, alignItems: 'center', justifyContent: 'center',
      paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: t.colors.border,
    },
    kindBtnText: { fontSize: 11, fontFamily: 'Poppins_600SemiBold' },

    // Stats
    sectionTitle: { fontSize: 14, fontFamily: 'Poppins_700Bold', letterSpacing: -0.2 },
    statBox:      { flex: 1, padding: 10, borderRadius: 10, borderWidth: 1, alignItems: 'center' },
    statValue:    { fontSize: 22, fontFamily: 'Poppins_800ExtraBold', letterSpacing: -0.5 },
    statLabel:    { fontSize: 9.5, fontFamily: 'Poppins_500Medium', color: t.colors.textMuted, marginTop: 2, textAlign: 'center' },
    statSubtle:   { fontSize: 11, fontFamily: 'Poppins_400Regular', marginTop: 4 },
    tokenRow:     { flexDirection: 'row', alignItems: 'center', gap: 8 },
    tokenLabel:   { flex: 1, fontSize: 12, fontFamily: 'Poppins_600SemiBold', textTransform: 'capitalize' },
    tokenValue:   { fontSize: 13, fontFamily: 'Poppins_700Bold' },
    historyRow:   { flexDirection: 'row', alignItems: 'center', gap: 8 },
    historyName:  { fontSize: 12, fontFamily: 'Poppins_700Bold' },
    historyDate:  { fontSize: 10, fontFamily: 'Poppins_400Regular', marginTop: 1 },
    historyBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  });
}
