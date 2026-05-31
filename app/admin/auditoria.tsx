/**
 * Admin → Auditoría
 *
 * Filtra y muestra el audit_log del backend. Funciona en web y native
 * (responsive: tabla en desktop, cards en móvil).
 */
import React, { useMemo, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl, Pressable, TextInput,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useQuery } from '@tanstack/react-query';
import { useFocusEffect } from '@react-navigation/native';
import { Skeleton } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import { PressableScale } from '../../components/ui/PressableScale';
import { useToast } from '../../components/ui/Toast';
import { useTheme } from '../../contexts/ThemeContext';
import { safeGoBack } from '../../utils/navigation';
import api from '../../services/api';

type AuditRow = {
  id: string;
  action: string;
  user_id: string | null;
  target_type: string | null;
  target_id: string | null;
  ip: string | null;
  user_agent: string | null;
  metadata: any;
  created_at: string;
  user: { id: string; username: string; full_name: string } | null;
};

const PAGE_SIZE = 50;

function actionBadgeColor(action: string): string {
  if (action.includes('failed') || action.includes('blocked') || action.includes('rejected')) return '#EF4444';
  if (action.includes('success') || action.includes('enabled')) return '#10B981';
  if (action.includes('login') || action.includes('signup'))    return '#3B82F6';
  if (action.includes('2fa'))                                    return '#8B5CF6';
  if (action.includes('admin'))                                  return '#F59E0B';
  return '#94A3B8';
}

function shortDate(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function AuditoriaScreen() {
  const { theme } = useTheme();
  const { width } = useWindowDimensions();
  const { showToast } = useToast();
  const isDesktop = width >= 900;

  const [actionFilter, setActionFilter] = useState('');
  const [page, setPage] = useState(1);

  const { data: actionTypes } = useQuery({
    queryKey: ['audit-actions'],
    queryFn: async () => {
      const res = await api.get('/api/admin/audit-log/actions');
      return res?.data ?? [];
    },
  });

  const { data, isLoading, refetch, isFetching, error } = useQuery({
    queryKey: ['audit-log', actionFilter, page],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
      if (actionFilter) params.set('action', actionFilter);
      const res = await api.get(`/api/admin/audit-log?${params.toString()}`);
      return res?.data ?? { rows: [], total: 0, pages: 1 };
    },
    // No keepPreviousData en esta pantalla — al cambiar de filtro queremos
    // ver el cambio inmediato, sin retener el set previo
    placeholderData: undefined,
  });

  // Si la query falla, lo mostramos al usuario (antes silenciaba el error)
  React.useEffect(() => {
    if (error) {
      const e = error as any;
      showToast('error', e?.response?.data?.message || 'Error al cargar el audit log');
      console.error('[Auditoria] query failed:', e?.response?.status, e?.response?.data, e?.message);
    }
  }, [error]);

  // Refetch al recibir focus + al cambiar el filtro (queryKey ya lo hace,
  // pero forzamos por si el cache tiene un set vacio antiguo)
  useFocusEffect(useCallback(() => { refetch(); }, [actionFilter, page]));

  const rows: AuditRow[] = data?.rows ?? [];
  const totalPages = Math.max(1, data?.pages ?? 1);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.bg }]} edges={['top']}>
      <LinearGradient
        colors={[theme.colors.primary, theme.colors.primaryLight]}
        start={{ x: 0, y: 0 }} end={{ x: 0.6, y: 1 }}
        style={styles.header}
      >
        <View style={styles.headerRow}>
          <Pressable onPress={() => safeGoBack('/admin')} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={20} color="rgba(255,255,255,0.85)" />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Auditoría</Text>
            <Text style={styles.subtitle}>
              {data?.total ?? 0} evento{data?.total === 1 ? '' : 's'} registrado{data?.total === 1 ? '' : 's'}
            </Text>
          </View>
          <Pressable onPress={() => refetch()} style={styles.refreshBtn}>
            <Ionicons name={isFetching ? 'sync' : 'refresh'} size={18} color="#fff" />
          </Pressable>
        </View>
      </LinearGradient>

      {/* Filtros */}
      <View style={[styles.filterBar, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
          <FilterChip
            label="Todos"
            active={!actionFilter}
            onPress={() => { setActionFilter(''); setPage(1); }}
            theme={theme}
          />
          {(actionTypes ?? []).slice(0, 20).map((a: any) => (
            <FilterChip
              key={a.action}
              label={`${a.action} (${a.count})`}
              active={actionFilter === a.action}
              onPress={() => { setActionFilter(a.action); setPage(1); }}
              theme={theme}
              color={actionBadgeColor(a.action)}
            />
          ))}
        </ScrollView>
      </View>

      <ScrollView
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={isFetching && !isLoading} onRefresh={() => refetch()} tintColor={theme.colors.primaryLight} />}
      >
        {isLoading ? (
          [1,2,3,4,5,6].map(i => <Skeleton key={i} width="100%" height={64} style={{ marginBottom: 8, borderRadius: 10 }} />)
        ) : rows.length === 0 ? (
          <View style={{ paddingVertical: 50 }}>
            <EmptyState
              icon="document-text-outline"
              title="Sin registros"
              description={actionFilter ? 'No hay eventos con este filtro' : 'El audit log está vacío'}
            />
          </View>
        ) : (
          <>
            {/* Header tabla desktop */}
            {isDesktop && (
              <View style={[styles.tableHeader, { backgroundColor: theme.colors.surfaceElevated, borderColor: theme.colors.border }]}>
                <Text style={[styles.th, { color: theme.colors.textMuted, width: 130 }]}>FECHA</Text>
                <Text style={[styles.th, { color: theme.colors.textMuted, flex: 2 }]}>ACCIÓN</Text>
                <Text style={[styles.th, { color: theme.colors.textMuted, flex: 2 }]}>USUARIO</Text>
                <Text style={[styles.th, { color: theme.colors.textMuted, width: 140 }]}>IP</Text>
                <Text style={[styles.th, { color: theme.colors.textMuted, flex: 3 }]}>DETALLES</Text>
              </View>
            )}

            {rows.map((r) => {
              const color = actionBadgeColor(r.action);
              const meta = r.metadata && typeof r.metadata === 'object' ? r.metadata : null;
              const summary = meta
                ? Object.entries(meta).slice(0, 3).map(([k, v]) => `${k}: ${String(v).slice(0, 40)}`).join(' · ')
                : '';

              return (
                <View
                  key={r.id}
                  style={[
                    isDesktop ? styles.tableRow : styles.card,
                    { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
                  ]}
                >
                  {isDesktop ? (
                    // Desktop: fila de tabla
                    <>
                      <Text style={[styles.td, { color: theme.colors.textSecondary, width: 130, fontSize: 11 }]}>
                        {shortDate(r.created_at)}
                      </Text>
                      <View style={{ flex: 2 }}>
                        <View style={[styles.actionPill, { backgroundColor: color + '20', borderColor: color + '50' }]}>
                          <Text style={[styles.actionText, { color }]}>{r.action}</Text>
                        </View>
                      </View>
                      <Text style={[styles.td, { color: theme.colors.textPrimary, flex: 2 }]}>
                        {r.user ? `@${r.user.username}` : meta?.username ? `@${meta.username} (sin user_id)` : '—'}
                      </Text>
                      <Text style={[styles.td, { color: theme.colors.textMuted, width: 140, fontSize: 11, fontFamily: 'Poppins_500Medium' }]}>
                        {r.ip ?? '—'}
                      </Text>
                      <Text style={[styles.td, { color: theme.colors.textSecondary, flex: 3, fontSize: 11 }]} numberOfLines={2}>
                        {summary}
                      </Text>
                    </>
                  ) : (
                    // Móvil: card vertical
                    <>
                      <View style={styles.cardTop}>
                        <View style={[styles.actionPill, { backgroundColor: color + '20', borderColor: color + '50' }]}>
                          <Text style={[styles.actionText, { color }]}>{r.action}</Text>
                        </View>
                        <Text style={[styles.cardTime, { color: theme.colors.textMuted }]}>{shortDate(r.created_at)}</Text>
                      </View>
                      <Text style={[styles.cardUser, { color: theme.colors.textPrimary }]}>
                        {r.user ? `@${r.user.username} (${r.user.full_name})` : meta?.username ? `@${meta.username}` : '—'}
                      </Text>
                      {!!r.ip && (
                        <Text style={[styles.cardIp, { color: theme.colors.textMuted }]}>IP: {r.ip}</Text>
                      )}
                      {!!summary && (
                        <Text style={[styles.cardMeta, { color: theme.colors.textSecondary }]} numberOfLines={3}>
                          {summary}
                        </Text>
                      )}
                    </>
                  )}
                </View>
              );
            })}

            {/* Paginación */}
            {totalPages > 1 && (
              <View style={[styles.pagination, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
                <PressableScale
                  onPress={() => page > 1 && setPage(p => p - 1)}
                  disabled={page === 1}
                  style={[styles.pageBtn, page === 1 && { opacity: 0.4 }]}
                >
                  <Ionicons name="chevron-back" size={16} color={theme.colors.primaryLight} />
                  <Text style={[styles.pageBtnText, { color: theme.colors.primaryLight }]}>Anterior</Text>
                </PressableScale>
                <Text style={[styles.pageNum, { color: theme.colors.textPrimary }]}>
                  Página {page} de {totalPages}
                </Text>
                <PressableScale
                  onPress={() => page < totalPages && setPage(p => p + 1)}
                  disabled={page >= totalPages}
                  style={[styles.pageBtn, page >= totalPages && { opacity: 0.4 }]}
                >
                  <Text style={[styles.pageBtnText, { color: theme.colors.primaryLight }]}>Siguiente</Text>
                  <Ionicons name="chevron-forward" size={16} color={theme.colors.primaryLight} />
                </PressableScale>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function FilterChip({ label, active, onPress, theme, color }: any) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        {
          backgroundColor: active
            ? (color ?? theme.colors.primaryLight) + '25'
            : theme.colors.surface,
          borderColor: active
            ? color ?? theme.colors.primaryLight
            : theme.colors.border,
        },
      ]}
    >
      <Text style={[
        styles.chipText,
        { color: active ? (color ?? theme.colors.primaryLight) : theme.colors.textSecondary },
      ]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 22 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.20)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' },
  refreshBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 22, fontFamily: 'Poppins_800ExtraBold', color: '#fff', letterSpacing: -0.4 },
  subtitle: { fontSize: 12, fontFamily: 'Poppins_400Regular', color: 'rgba(255,255,255,0.7)', marginTop: 1 },

  filterBar: { paddingVertical: 10, paddingHorizontal: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, borderWidth: 1 },
  chipText: { fontSize: 11, fontFamily: 'Poppins_700Bold', letterSpacing: 0.2 },

  listContent: { padding: 14, gap: 8 },

  tableHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 12, paddingVertical: 8,
    borderTopLeftRadius: 10, borderTopRightRadius: 10,
    borderWidth: 1, borderBottomWidth: 0,
  },
  th: { fontSize: 10, fontFamily: 'Poppins_700Bold', letterSpacing: 1, textTransform: 'uppercase' as const },
  tableRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 12, paddingVertical: 10,
    borderWidth: StyleSheet.hairlineWidth, borderTopWidth: 0,
  },
  td: { fontSize: 12, fontFamily: 'Poppins_500Medium' },

  card: { padding: 14, borderRadius: 12, borderWidth: 1, gap: 6 },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardTime: { fontSize: 11, fontFamily: 'Poppins_500Medium' },
  cardUser: { fontSize: 13, fontFamily: 'Poppins_700Bold' },
  cardIp: { fontSize: 11, fontFamily: 'Poppins_500Medium' },
  cardMeta: { fontSize: 11, fontFamily: 'Poppins_400Regular', lineHeight: 16 },

  actionPill: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, borderWidth: 1 },
  actionText: { fontSize: 10.5, fontFamily: 'Poppins_700Bold', letterSpacing: 0.3 },

  pagination: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 12, borderRadius: 12, borderWidth: 1, marginTop: 8,
  },
  pageBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 8 },
  pageBtnText: { fontSize: 12, fontFamily: 'Poppins_700Bold' },
  pageNum: { fontSize: 12, fontFamily: 'Poppins_600SemiBold' },
});
