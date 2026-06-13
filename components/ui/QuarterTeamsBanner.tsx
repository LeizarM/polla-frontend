/**
 * QuarterTeamsBanner — muestra los 8 equipos clasificados a Cuartos de Final
 * (los elegibles para armar el podio de la Polla Final). Si todavía NO hay
 * clasificados, no renderiza nada → aparece solo cuando el admin marca equipos.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { TeamFlag } from './TeamFlag';
import { useTheme } from '../../contexts/ThemeContext';
import api from '../../services/api';

export function QuarterTeamsBanner({ tournamentId }: { tournamentId?: string }) {
  const { theme } = useTheme();

  // Misma queryKey que usa el modal de apuesta → React Query comparte la caché.
  const { data: teams } = useQuery({
    queryKey: ['quarter-teams', tournamentId],
    queryFn: async () => {
      try {
        const res = await api.get(`/api/tournaments/${tournamentId}/quarter-teams`);
        return res?.data ?? [];
      } catch { return []; }
    },
    enabled: !!tournamentId,
    staleTime: 30000,
  });

  const list = Array.isArray(teams) ? teams : [];
  if (list.length === 0) return null; // aún sin clasificados → no se muestra

  return (
    <View style={[styles.wrap, { backgroundColor: theme.colors.surface, borderColor: '#FFD70033' }]}>
      {/* Filo dorado superior */}
      <LinearGradient
        colors={['#FFD700', '#F59E0B', 'transparent']}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
        style={styles.topEdge}
      />
      <View style={styles.header}>
        <Ionicons name="trophy" size={15} color="#FFD700" />
        <Text style={[styles.title, { color: theme.colors.textPrimary }]}>Clasificados a Cuartos</Text>
        <View style={[styles.countPill, { backgroundColor: '#FFD70018', borderColor: '#FFD70055' }]}>
          <Text style={styles.countTx}>{list.length}/8</Text>
        </View>
      </View>

      <View style={styles.grid}>
        {list.map((tm: any, i: number) => (
          <View
            key={tm?.id ?? i}
            style={[styles.chip, { backgroundColor: theme.colors.inputBg, borderColor: theme.colors.border }]}
          >
            <TeamFlag team={tm} size={24} />
            <Text style={[styles.chipTx, { color: theme.colors.textSecondary }]} numberOfLines={1}>
              {tm?.name ?? '-'}
            </Text>
          </View>
        ))}
      </View>

      <Text style={[styles.foot, { color: theme.colors.textMuted }]}>
        Estos son los equipos elegibles para armar tu podio.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    paddingTop: 16,
    marginBottom: 20,
    overflow: 'hidden',
    width: '100%',
    maxWidth: 880,
    alignSelf: 'center',
  },
  topEdge: { position: 'absolute', left: 0, right: 0, top: 0, height: 2 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  title: { flex: 1, fontSize: 14, fontFamily: 'Poppins_700Bold', letterSpacing: -0.2 },
  countPill: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999, borderWidth: 1 },
  countTx: { fontSize: 12, fontFamily: 'Poppins_800ExtraBold', color: '#D4A017' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    paddingHorizontal: 10, paddingVertical: 7, borderRadius: 999, borderWidth: 1,
  },
  chipTx: { fontSize: 12.5, fontFamily: 'Poppins_600SemiBold', maxWidth: 130 },
  foot: { fontSize: 11, fontFamily: 'Poppins_400Regular', marginTop: 10, fontStyle: 'italic' },
});
