/**
 * Admin Usuarios — Premium user management list
 * Stats summary · gradient avatars · stagger animations · search
 */
import React, { useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
} from 'react-native';
import { SafeAreaView }    from 'react-native-safe-area-context';
import { LinearGradient }  from 'expo-linear-gradient';
import { Ionicons }        from '@expo/vector-icons';
import { useQuery }        from '@tanstack/react-query';
import { router }          from 'expo-router';
import { useFocusEffect }  from '@react-navigation/native';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { Badge }        from '../../components/ui/Badge';
import { Skeleton }     from '../../components/ui/Skeleton';
import { EmptyState }   from '../../components/ui/EmptyState';
import { SearchBar }    from '../../components/ui/SearchBar';
import { useTheme }     from '../../contexts/ThemeContext';
import api from '../../services/api';

// ─── Gradient palettes for avatars (cycle by index) ───────────────────────────
const AVATAR_GRADIENTS: [string, string][] = [
  ['#1D4ED8', '#2563EB'],
  ['#7C3AED', '#9333EA'],
  ['#059669', '#10B981'],
  ['#DC2626', '#EF4444'],
  ['#D97706', '#F59E0B'],
  ['#0891B2', '#06B6D4'],
];

function formatCurrency(amount: number): string {
  return `Bs ${Number(amount ?? 0).toFixed(2)}`;
}

// ─── User row ─────────────────────────────────────────────────────────────────

function UserRow({
  user, index, theme,
}: { user: any; index: number; theme: any }) {
  const initials = (user?.full_name ?? user?.username ?? '?')
    .split(' ').map((w: string) => w?.[0] ?? '').slice(0, 2).join('').toUpperCase();

  const gradColors = AVATAR_GRADIENTS[index % AVATAR_GRADIENTS.length];
  const isActive   = user?.status === 'active';

  return (
    <Animated.View entering={FadeInDown.delay(index * 55).duration(340).springify()}>
      <Pressable
        onPress={() => router.push(`/admin-usuario/${user?.id}` as any)}
        style={({ pressed }) => [
          styles.userRow,
          {
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.border,
            opacity: pressed ? 0.8 : 1,
          },
        ]}
      >
        {/* Avatar */}
        <LinearGradient
          colors={gradColors}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={styles.avatar}
        >
          <Text style={styles.avatarText}>{initials}</Text>
        </LinearGradient>

        {/* Info */}
        <View style={styles.userInfo}>
          <Text style={[styles.userName, { color: theme.colors.textPrimary }]} numberOfLines={1}>
            {user?.full_name ?? user?.username}
          </Text>
          <Text style={[styles.userUsername, { color: theme.colors.textSecondary }]}>
            @{user?.username}
          </Text>
          <View style={styles.userMeta}>
            <Ionicons name="wallet-outline" size={11} color={theme.colors.textMuted} />
            <Text style={[styles.userBalance, { color: theme.colors.textMuted }]}>
              {formatCurrency(Number(user?.balance ?? 0))}
            </Text>
            {user?.role === 'admin' && (
              <>
                <View style={[styles.metaDot, { backgroundColor: theme.colors.border }]} />
                <Text style={[styles.userRoleBadge, { color: theme.colors.primaryLight }]}>
                  Admin
                </Text>
              </>
            )}
          </View>
        </View>

        {/* Status + chevron */}
        <View style={styles.userRight}>
          <View style={[
            styles.statusPill,
            { backgroundColor: isActive ? '#10B98118' : '#EF444418' },
          ]}>
            <View style={[
              styles.statusDot,
              { backgroundColor: isActive ? '#10B981' : '#EF4444' },
            ]} />
            <Text style={[
              styles.statusText,
              { color: isActive ? '#10B981' : '#EF4444' },
            ]}>
              {isActive ? 'Activo' : 'Inactivo'}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={15} color={theme.colors.textMuted} style={{ marginTop: 6 }} />
        </View>
      </Pressable>
    </Animated.View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function UsuariosScreen() {
  const { theme } = useTheme();
  const [searchQuery, setSearchQuery] = React.useState('');

  const { data: users, isLoading, refetch } = useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => {
      try {
        const res = await api.get('/api/admin/users');
        return res.data ?? [];
      } catch { return []; }
    },
  });

  useFocusEffect(useCallback(() => { refetch(); }, []));

  const filteredUsers = useMemo(() => {
    if (!searchQuery) return users ?? [];
    const q = searchQuery.toLowerCase();
    return (users ?? []).filter((u: any) =>
      u?.full_name?.toLowerCase()?.includes(q) ||
      u?.username?.toLowerCase()?.includes(q)
    );
  }, [users, searchQuery]);

  // ── Stats ──────────────────────────────────────────────────────────────────
  const totalUsers   = users?.length ?? 0;
  const activeUsers  = (users ?? []).filter((u: any) => u?.status === 'active').length;
  const blockedUsers = totalUsers - activeUsers;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.bg }]} edges={['top']}>

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <Animated.View entering={FadeIn.duration(380)}>
        <LinearGradient
          colors={[theme.colors.primary, theme.colors.primaryLight]}
          start={{ x: 0, y: 0 }} end={{ x: 0.7, y: 1 }}
          style={styles.headerGrad}
        >
          <View style={styles.headerRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.headerTitle}>Usuarios</Text>
              <Text style={styles.headerSubtitle}>
                Gestiona los participantes
              </Text>
            </View>
            {!isLoading && totalUsers > 0 && (
              <View style={[styles.totalBadge, { backgroundColor: 'rgba(255,255,255,0.12)', borderColor: 'rgba(255,255,255,0.20)' }]}>
                <Text style={[styles.totalBadgeText, { color: 'rgba(255,255,255,0.9)' }]}>
                  {totalUsers}
                </Text>
              </View>
            )}
          </View>
        </LinearGradient>
      </Animated.View>

      {/* ── Stats row ───────────────────────────────────────────────────────── */}
      {!isLoading && totalUsers > 0 && (
        <Animated.View entering={FadeInDown.delay(80).duration(340)} style={styles.statsRow}>
          {/* Total */}
          <View style={[styles.statCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
            <View style={[styles.statIcon, { backgroundColor: theme.colors.primaryLight + '18' }]}>
              <Ionicons name="people-outline" size={16} color={theme.colors.primaryLight} />
            </View>
            <Text style={[styles.statVal, { color: theme.colors.textPrimary }]}>{totalUsers}</Text>
            <Text style={[styles.statLabel, { color: theme.colors.textMuted }]}>Total</Text>
          </View>
          {/* Active */}
          <View style={[styles.statCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
            <View style={[styles.statIcon, { backgroundColor: '#10B98118' }]}>
              <Ionicons name="checkmark-circle-outline" size={16} color="#10B981" />
            </View>
            <Text style={[styles.statVal, { color: theme.colors.textPrimary }]}>{activeUsers}</Text>
            <Text style={[styles.statLabel, { color: theme.colors.textMuted }]}>Activos</Text>
          </View>
          {/* Blocked */}
          <View style={[styles.statCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
            <View style={[styles.statIcon, { backgroundColor: '#EF444418' }]}>
              <Ionicons name="ban-outline" size={16} color="#EF4444" />
            </View>
            <Text style={[styles.statVal, { color: theme.colors.textPrimary }]}>{blockedUsers}</Text>
            <Text style={[styles.statLabel, { color: theme.colors.textMuted }]}>Bloqueados</Text>
          </View>
        </Animated.View>
      )}

      {/* ── Search ──────────────────────────────────────────────────────────── */}
      <Animated.View entering={FadeInDown.delay(130).duration(320)} style={styles.searchWrap}>
        <SearchBar
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Buscar por nombre o usuario..."
        />
      </Animated.View>

      {/* ── List ────────────────────────────────────────────────────────────── */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      >
        {isLoading ? (
          <>
            {[1, 2, 3, 4, 5].map((i) => (
              <Animated.View
                key={i}
                entering={FadeInDown.delay(i * 60).duration(300)}
                style={[styles.skeletonRow, {
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.border,
                }]}
              >
                <Skeleton shape="circle" width={48} height={48} />
                <View style={{ flex: 1, marginLeft: 12, gap: 8 }}>
                  <Skeleton width="55%" height={14} />
                  <Skeleton width="38%" height={12} />
                </View>
                <Skeleton width={60} height={26} style={{ borderRadius: 13 }} />
              </Animated.View>
            ))}
          </>
        ) : filteredUsers.length === 0 ? (
          <EmptyState
            icon="people-outline"
            title={searchQuery ? 'Sin resultados' : 'Sin usuarios'}
            description={
              searchQuery
                ? `No se encontró "${searchQuery}"`
                : 'Los usuarios aparecerán aquí al registrarse'
            }
          />
        ) : (
          <>
            {filteredUsers.map((user: any, i: number) => (
              <UserRow key={user.id} user={user} index={i} theme={theme} />
            ))}
            <View style={{ height: 100 }} />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },

  headerGrad: { paddingBottom: 22 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 14,
    gap: 12,
  },
  headerTitle: {
    fontSize: 24,
    fontFamily: 'Poppins_800ExtraBold',
    color: '#fff',
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 13,
    fontFamily: 'Poppins_400Regular',
    color: 'rgba(255,255,255,0.6)',
    marginTop: 2,
  },
  totalBadge: {
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
  },
  totalBadgeText: {
    fontSize: 15,
    fontFamily: 'Poppins_700Bold',
  },

  // Stats row
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 10,
    marginTop: 8,
    marginBottom: 4,
  },
  statCard: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    alignItems: 'center',
    gap: 5,
  },
  statIcon: {
    width: 34, height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statVal: {
    fontSize: 18,
    fontFamily: 'Poppins_700Bold',
    letterSpacing: -0.3,
  },
  statLabel: {
    fontSize: 10,
    fontFamily: 'Poppins_400Regular',
  },

  // Search
  searchWrap: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
  },

  // List
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },

  // User row
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },
  avatar: {
    width: 48, height: 48,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    fontFamily: 'Poppins_700Bold',
  },
  userInfo: { flex: 1 },
  userName: {
    fontSize: 14,
    fontFamily: 'Poppins_600SemiBold',
    letterSpacing: -0.1,
  },
  userUsername: {
    fontSize: 12,
    fontFamily: 'Poppins_400Regular',
    marginTop: 1,
  },
  userMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  userBalance: {
    fontSize: 11,
    fontFamily: 'Poppins_400Regular',
  },
  metaDot: {
    width: 3, height: 3,
    borderRadius: 2,
  },
  userRoleBadge: {
    fontSize: 10,
    fontFamily: 'Poppins_600SemiBold',
  },
  userRight: {
    alignItems: 'flex-end',
    gap: 2,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 20,
    gap: 5,
  },
  statusDot: {
    width: 6, height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 11,
    fontFamily: 'Poppins_600SemiBold',
  },

  // Skeleton row
  skeletonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
    gap: 12,
  },
});
