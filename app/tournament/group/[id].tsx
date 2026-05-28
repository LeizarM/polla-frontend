/**
 * Group Manage — Premium group management screen
 * Gradient header · position chips · medal colors · Poppins typography
 */
import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { safeGoBack } from '../../../utils/navigation';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '../../../components/ui/Button';
import { Skeleton } from '../../../components/ui/Skeleton';
import { TeamFlag } from '../../../components/ui/TeamFlag';
import { useToast } from '../../../components/ui/Toast';
import { useTheme } from '../../../contexts/ThemeContext';
import { theme as staticTheme } from '../../../constants/theme';
import api from '../../../services/api';

export default function GroupManageScreen() {
  const { id = '' } = useLocalSearchParams<{ id: string }>();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const [refreshing, setRefreshing] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [results, setResults] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const { data: group, isLoading, refetch } = useQuery({
    queryKey: ['group', id],
    queryFn: async () => {
      const res = await api.get(`/api/groups/${id}`);
      return res?.data;
    },
    enabled: !!id,
  });

  const teams = group?.teams ?? [];

  React.useEffect(() => {
    if (group) {
      setResults({
        result_1st: group.result_1st ?? '',
        result_2nd: group.result_2nd ?? '',
        result_3rd: group.result_3rd ?? '',
        result_4th: group.result_4th ?? '',
      });
    }
  }, [group]);

  const handleSaveResults = async () => {
    if (!results.result_1st || !results.result_2nd) {
      showToast('error', 'Selecciona al menos 1ro y 2do lugar');
      return;
    }
    setSaving(true);
    try {
      await api.patch(`/api/groups/${id}/results`, results);
      showToast('success', 'Resultados guardados');
      refetch();
    } catch (error: any) {
      showToast('error', error?.friendlyMessage || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const handleResolve = async () => {
    setResolving(true);
    try {
      const res = await api.post(`/api/groups/${id}/resolve`);
      const data = res?.data;
      showToast('success', `¡Grupo resuelto! ${data?.winners_count ?? 0} ganadores`);
      refetch();
    } catch (error: any) {
      showToast('error', error?.response?.data?.message || 'Error al resolver');
    } finally {
      setResolving(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const getTeamName = (teamId: string) => teams.find((t: any) => t?.id === teamId)?.name ?? '—';

  const positions = [
    { key: 'result_1st', label: '🥇 1er Lugar', color: '#FFD700' },
    { key: 'result_2nd', label: '🥈 2do Lugar', color: '#C0C0C0' },
    { key: 'result_3rd', label: '🥉 3er Lugar', color: '#CD7F32' },
    { key: 'result_4th', label: '4to Lugar',    color: '#94A3B8' },
  ];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.bg }]} edges={['top']}>

      {/* Gradient header */}
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
                {group?.name ?? 'Grupo'}
              </Text>
              <Text style={styles.headerSubtitle} numberOfLines={1}>
                {group?.tournament?.name} · Pozo: ${Number(group?.total_pool ?? 0).toFixed(2)}
              </Text>
            </View>
            <View style={styles.headerIcon}>
              <Ionicons name="people" size={20} color="rgba(255,255,255,0.85)" />
            </View>
          </View>
        </LinearGradient>
      </Animated.View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primaryLight} />
        }
      >
        {isLoading ? (
          <View style={{ gap: 10 }}>
            <Skeleton width="100%" height={300} style={{ borderRadius: 14 }} />
          </View>
        ) : (
          <>
            {/* Teams list */}
            <Animated.View entering={FadeInDown.delay(60).duration(360)}>
              <Text style={[styles.sectionTitle, { color: theme.colors.textPrimary }]}>
                Equipos del Grupo
              </Text>
              {teams.map((team: any, idx: number) => (
                <View
                  key={team?.id}
                  style={[styles.teamRow, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
                >
                  <LinearGradient
                    colors={[theme.colors.primary, theme.colors.primaryLight, 'transparent']}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                    style={{ width: 3, height: '100%', position: 'absolute', left: 0 }}
                  />
                  <View style={{ width: 3 }} />
                  <TeamFlag team={team} size={28} />
                  <Text style={[styles.teamName, { color: theme.colors.textPrimary }]}>{team?.name}</Text>
                  <Text style={[styles.teamCountry, { color: theme.colors.textSecondary }]}>{team?.country}</Text>
                </View>
              ))}
            </Animated.View>

            {/* Position selectors (unresolved) */}
            {group?.status !== 'resolved' && (
              <Animated.View entering={FadeInDown.delay(140).duration(360)}>
                <Text style={[styles.sectionTitle, { color: theme.colors.textPrimary, marginTop: 20 }]}>
                  Posiciones
                </Text>
                {positions.map(pos => (
                  <View key={pos.key} style={{ marginBottom: 14 }}>
                    <Text style={[styles.posLabel, { color: pos.color }]}>{pos.label}</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      {teams.map((t: any) => (
                        <Pressable
                          key={t?.id}
                          style={[
                            styles.posChip,
                            { borderColor: theme.colors.border },
                            results[pos.key] === t?.id && {
                              borderColor: pos.color,
                              backgroundColor: `${pos.color}20`,
                            },
                          ]}
                          onPress={() => setResults(prev => ({ ...prev, [pos.key]: t?.id }))}
                        >
                          <Text style={[
                            styles.posChipText,
                            { color: theme.colors.textSecondary },
                            results[pos.key] === t?.id && { color: pos.color },
                          ]}>
                            {t?.name}
                          </Text>
                        </Pressable>
                      ))}
                    </ScrollView>
                  </View>
                ))}

                <Button
                  title="Guardar Resultados"
                  variant="primary"
                  size="lg"
                  fullWidth
                  onPress={handleSaveResults}
                  loading={saving}
                  style={{ marginTop: 8 }}
                />

                {group?.result_1st && group?.result_2nd && (
                  <Button
                    title="🏆 Resolver Grupo"
                    variant="accent"
                    size="lg"
                    fullWidth
                    onPress={handleResolve}
                    loading={resolving}
                    style={{ marginTop: 12 }}
                  />
                )}
              </Animated.View>
            )}

            {/* Resolved state */}
            {group?.status === 'resolved' && (
              <Animated.View entering={FadeInDown.delay(140).duration(360)}>
                <View style={[styles.resolvedCard, { backgroundColor: theme.colors.surface, borderColor: '#FFD70030' }]}>
                  <LinearGradient
                    colors={['#FFD700', '#F59E0B', 'transparent']}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                    style={{ height: 1.5 }}
                  />
                  <View style={styles.resolvedBody}>
                    <Text style={styles.resolvedTitle}>🏆 Grupo Resuelto</Text>
                    {positions.map(pos => (
                      group?.[pos.key] ? (
                        <View key={pos.key} style={[styles.resultRow, { borderBottomColor: theme.colors.border }]}>
                          <Text style={[styles.posLabel, { color: pos.color }]}>{pos.label}</Text>
                          <Text style={[styles.resultTeam, { color: theme.colors.textPrimary }]}>
                            {getTeamName(group[pos.key])}
                          </Text>
                        </View>
                      ) : null
                    ))}
                  </View>
                </View>
              </Animated.View>
            )}
          </>
        )}
        <View style={{ height: 60 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(t: typeof staticTheme) {
  return StyleSheet.create({
    container: { flex: 1 },
    headerGrad: { paddingBottom: 22 },
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
    headerTitle: { fontSize: 20, fontFamily: 'Poppins_700Bold', color: '#fff', letterSpacing: -0.3 },
    headerSubtitle: { fontSize: 12, fontFamily: 'Poppins_400Regular', color: 'rgba(255,255,255,0.6)', marginTop: 1 },
    headerIcon: {
      width: 42, height: 42, borderRadius: 13,
      backgroundColor: 'rgba(255,255,255,0.12)',
      alignItems: 'center', justifyContent: 'center',
    },
    content: { flex: 1 },
    scrollContent: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 80 },

    sectionTitle: { fontSize: 16, fontFamily: 'Poppins_700Bold', letterSpacing: -0.2, marginBottom: 10 },

    teamRow: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      paddingHorizontal: 14, paddingVertical: 10,
      marginBottom: 6, overflow: 'hidden',
      borderRadius: 12, borderWidth: 1,
    },
    teamName: { fontSize: 14, fontFamily: 'Poppins_600SemiBold', flex: 1 },
    teamCountry: { fontSize: 11, fontFamily: 'Poppins_400Regular' },

    posLabel: { fontSize: 13, fontFamily: 'Poppins_600SemiBold', marginBottom: 8 },
    posChip: {
      paddingHorizontal: 14, paddingVertical: 7,
      borderRadius: 999, borderWidth: 1, marginRight: 6,
    },
    posChipText: { fontSize: 12, fontFamily: 'Poppins_500Medium' },

    resolvedCard: {
      borderRadius: 16, borderWidth: 1, overflow: 'hidden', marginTop: 20,
      shadowColor: '#F59E0B', shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.12, shadowRadius: 10, elevation: 4,
    },
    resolvedBody: { padding: 16 },
    resolvedTitle: { fontSize: 17, fontFamily: 'Poppins_700Bold', color: '#F59E0B', textAlign: 'center', marginBottom: 16 },
    resultRow: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth,
    },
    resultTeam: { fontSize: 14, fontFamily: 'Poppins_600SemiBold' },
  });
}
