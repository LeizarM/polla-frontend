/**
 * User Home — Premium dashboard
 * Hero orbs · overlapping stat card · animated quick actions · matchday carousel
 */
import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  Pressable,
  Platform,
  StyleSheet,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import Animated, {
  FadeInDown,
  FadeIn,
  ZoomIn,
} from 'react-native-reanimated';
import { Skeleton }    from '../../components/ui/Skeleton';
import { EmptyState }  from '../../components/ui/EmptyState';
import { useAuthStore }  from '../../store/authStore';
import { useTheme }      from '../../contexts/ThemeContext';
import { fonts }         from '../../constants/theme';
import api               from '../../services/api';
import { parseBackendDate } from '../../utils/date';
import { useBreakpoint }   from '../../hooks/useBreakpoint';
import { formatMoney }     from '../../utils/currency';
import { usePollaFinalEnabled } from '../../hooks/useAppSettings';

// Wrapper para mantener compatibilidad con código existente.
// formatMoney es smart: "Bs 30" cuando entero, "Bs 7.50" cuando fraccional.
function formatCurrency(amount: number, currency = 'Bs'): string {
  return formatMoney(amount, currency);
}

// ─── Quick Action ──────────────────────────────────────────────────────────────

function QuickAction({
  icon, label, colors, onPress, delay,
}: {
  icon: string; label: string;
  colors: [string, string]; onPress: () => void; delay: number;
}) {
  return (
    <Animated.View entering={ZoomIn.delay(delay).duration(280).springify()} style={styles.quickAction}>
      <Pressable onPress={onPress} style={{ alignItems: 'center', gap: 8 }}>
        <LinearGradient
          colors={colors}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={styles.quickActionGrad}
        >
          <Ionicons name={icon as any} size={24} color="#fff" />
        </LinearGradient>
        <Text style={styles.quickActionLabel}>{label}</Text>
      </Pressable>
    </Animated.View>
  );
}

// ─── Matchday Card ─────────────────────────────────────────────────────────────

const DAY_NAMES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

function MatchdayCard({ matchday, onPress, fullWidth = false }: { matchday: any; onPress: () => void; fullWidth?: boolean }) {
  const { theme } = useTheme();
  const tournament = matchday?.tournament;
  const currency   = tournament?.currency ?? 'Bs';

  // Inscritos APROBADOS (los únicos que pagan al pozo). approved_participants
  // viene del backend; el matchday ya trae participant_count (también aprobados).
  const inscritos = Number(
    tournament?.approved_participants
    ?? matchday?.participant_count
    ?? tournament?._count?.participants
    ?? tournament?.participants?.length
    ?? 0,
  );

  // Per-participant bet amount, set when tournament was created
  const betAmount = Number(tournament?.bet_per_matchday ?? 0);

  // Pozo REAL: solo lo efectivamente apostado (crece con cada apuesta). Igual
  // criterio en todas las pantallas (detalle jornada + lista Apostar).
  const realPool = Number(matchday?.total_pool ?? 0);
  // Pozo POTENCIAL = inscritos aprobados × monto fijo (lo máximo si todos apuestan).
  const potentialPool = inscritos * betAmount;
  // Nº de apuestas reales que formaron el pozo (pozo / monto por jornada)
  const betsPlaced = betAmount > 0 ? Math.round(realPool / betAmount) : 0;

  const matchCount = Number(
    matchday?.matches?.length
    ?? matchday?.match_count
    ?? 0,
  );

  // Date label: "Sáb 23/05"
  const dateLabel = (() => {
    const d = parseBackendDate(matchday?.date);
    if (!d) return '—';
    const day  = DAY_NAMES[d.getDay()];
    const dd   = String(d.getDate()).padStart(2, '0');
    const mm   = String(d.getMonth() + 1).padStart(2, '0');
    return `${day} ${dd}/${mm}`;
  })();

  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.mdCard,
        fullWidth && styles.mdCardFull,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.border,
        },
      ]}
    >
      {/* Tournament gradient header */}
      <LinearGradient
        colors={[theme.colors.primary, theme.colors.primaryLight]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
        style={styles.mdCardHeader}
      >
        <Ionicons name="trophy" size={12} color="rgba(255,255,255,0.85)" />
        <Text style={styles.mdCardTournament} numberOfLines={1}>
          {tournament?.name ?? 'Torneo'}
        </Text>
      </LinearGradient>

      <View style={styles.mdCardBody}>
        {/* Matchday name */}
        <Text style={[styles.mdCardName, { color: theme.colors.textPrimary }]} numberOfLines={2}>
          {matchday?.name ?? 'Jornada'}
        </Text>

        {/* Date + match count */}
        <View style={styles.mdCardMeta}>
          <View style={styles.mdCardMetaItem}>
            <Ionicons name="calendar-outline" size={12} color={theme.colors.textSecondary} />
            <Text style={[styles.mdCardMetaText, { color: theme.colors.textSecondary }]}>
              {dateLabel}
            </Text>
          </View>
          <Text style={[styles.mdCardMetaDot, { color: theme.colors.border }]}>·</Text>
          <View style={styles.mdCardMetaItem}>
            <Ionicons name="football-outline" size={12} color={theme.colors.textSecondary} />
            <Text style={[styles.mdCardMetaText, { color: theme.colors.textSecondary }]}>
              {matchCount} {matchCount === 1 ? 'partido' : 'partidos'}
            </Text>
          </View>
        </View>

        {/* Info grid: inscritos + bet amount */}
        <View style={styles.mdInfoGrid}>
          <View style={[styles.mdInfoCell, { backgroundColor: theme.colors.inputBg, borderColor: theme.colors.border }]}>
            <View style={styles.mdInfoCellTop}>
              <Ionicons name="people" size={13} color={theme.colors.primaryLight} />
              <Text style={[styles.mdInfoLabel, { color: theme.colors.textMuted }]}>Inscritos</Text>
            </View>
            <Text style={[styles.mdInfoValue, { color: theme.colors.textPrimary }]}>
              {inscritos}
            </Text>
            {betsPlaced > 0 && betsPlaced < inscritos && (
              <Text style={[styles.mdInfoHint, { color: theme.colors.textMuted }]}>
                {betsPlaced} ya apostó
              </Text>
            )}
          </View>
          <View style={[styles.mdInfoCell, { backgroundColor: theme.colors.inputBg, borderColor: theme.colors.border }]}>
            <View style={styles.mdInfoCellTop}>
              <Ionicons name="cash" size={13} color="#10B981" />
              <Text style={[styles.mdInfoLabel, { color: theme.colors.textMuted }]}>Apuesta</Text>
            </View>
            <Text style={[styles.mdInfoValue, { color: theme.colors.textPrimary }]}>
              {currency} {betAmount}
            </Text>
            <Text style={[styles.mdInfoHint, { color: theme.colors.textMuted }]}>
              por persona
            </Text>
          </View>
        </View>

        {/* Pozo real + potencial */}
        <View style={[styles.mdPoolBox, { borderColor: '#10B98140', backgroundColor: '#10B98112' }]}>
          <View style={styles.mdPoolRow}>
            <Ionicons name="trophy" size={15} color="#10B981" />
            <Text style={[styles.mdPoolLabel, { color: theme.colors.textSecondary }]}>Pozo actual</Text>
            <Text style={[styles.mdPoolValue, { color: '#10B981' }]}>
              {currency} {realPool.toFixed(2)}
            </Text>
          </View>
          <Text style={[styles.mdPoolHint, { color: theme.colors.textMuted }]}>
            {betsPlaced} apuesta{betsPlaced === 1 ? '' : 's'} registrada{betsPlaced === 1 ? '' : 's'} · crece {currency} {betAmount} por apuesta
            {potentialPool > 0 ? ` · hasta ${currency} ${potentialPool.toFixed(2)} si los ${inscritos} apuestan` : ''}
          </Text>
        </View>

        {/* CTA */}
        <LinearGradient
          colors={[theme.colors.primary, theme.colors.primaryLight]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          style={styles.mdCardCta}
        >
          <Text style={styles.mdCardCtaText}>Apostar</Text>
          <Ionicons name="arrow-forward" size={13} color="#fff" />
        </LinearGradient>
      </View>
    </Pressable>
  );
}

// ─── Tournament Row ────────────────────────────────────────────────────────────

function TournamentRow({
  enrollment, onPress, colorSet,
}: { enrollment: any; onPress: () => void; colorSet: [string, string] }) {
  const { theme } = useTheme();
  const t = enrollment?.tournament;

  return (
    <Pressable
      onPress={onPress}
      style={[styles.tournamentRow, {
        backgroundColor: theme.colors.surface,
        borderColor: theme.colors.border,
      }]}
    >
      <LinearGradient
        colors={colorSet}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={styles.tournamentRowIcon}
      >
        <Ionicons name="trophy" size={18} color="#fff" />
      </LinearGradient>
      <View style={{ flex: 1 }}>
        <Text style={[styles.tournamentRowName, { color: theme.colors.textPrimary }]} numberOfLines={1}>
          {t?.name ?? 'Torneo'}
        </Text>
        <Text style={[styles.tournamentRowSub, { color: theme.colors.textSecondary }]}>
          {t?._count?.matchdays ?? 0} jornadas · {t?.currency ?? 'Bs'} {Number(t?.bet_per_matchday ?? 0)}/jornada
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={theme.colors.textMuted} />
    </Pressable>
  );
}

// ─── Palette for tournament rows ───────────────────────────────────────────────

const TOURNAMENT_PALETTES: [string, string][] = [
  ['#001A6E', '#1A6BFF'],
  ['#8B0014', '#C8102E'],
  ['#064E3B', '#059669'],
  ['#4C1D95', '#7C3AED'],
];

// ─── Main screen ───────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const { user, refreshUser } = useAuthStore();
  // Setting controlado por admin — si está OFF, escondemos el botón
  // "Polla Final" para usuarios normales (y como esta pantalla es la del
  // usuario, ningún admin debería estar aquí, pero por consistencia
  // simplemente respetamos el setting tal cual).
  const { enabled: pollaEnabled } = usePollaFinalEnabled();
  const { theme }             = useTheme();
  const { isDesktop }         = useBreakpoint();
  const [refreshing, setRefreshing] = useState(false);

  const { data: matchdays, isLoading: matchdaysLoading, refetch: refetchMatchdays } = useQuery({
    queryKey: ['matchdays-active'],
    queryFn: async () => {
      try {
        // upcoming=true → solo jornadas que aparecen desde 1 día antes de su fecha
        const res = await api.get('/api/matchdays?status=open&upcoming=true');
        return res?.data ?? [];
      } catch { return []; }
    },
  });

  // Mis tickets de todos los torneos → suma `prize_won` = total ganado acumulado.
  // Coincide con la columna "Ganado" del PDF de Reporte Acumulado.
  const { data: myTickets, refetch: refetchMyTickets } = useQuery({
    queryKey: ['my-tickets-home'],
    queryFn: async () => {
      try {
        const res = await api.get('/api/tickets/me');
        return res?.data ?? [];
      } catch { return []; }
    },
  });

  // Total acumulado ganado = suma de prize_won de todos mis tickets.
  const totalWon = useMemo(() => {
    if (!Array.isArray(myTickets)) return 0;
    return myTickets.reduce((sum: number, t: any) => sum + Number(t?.prize_won ?? 0), 0);
  }, [myTickets]);

  const { data: enrollments, refetch: refetchEnrollments } = useQuery({
    queryKey: ['my-enrollments-home'],
    queryFn: async () => {
      try {
        const res = await api.get('/api/tournament-participants/me');
        return (res?.data ?? []).filter((e: any) => e?.status === 'approved');
      } catch { return []; }
    },
  });

  // Tournaments with participant counts — used to enrich matchday cards so they show
  // the correct INSCRITOS number (the matchdays endpoint doesn't always expose _count).
  const { data: tournamentList, refetch: refetchTournamentList } = useQuery({
    queryKey: ['tournaments-active-counts'],
    queryFn: async () => {
      try {
        const res = await api.get('/api/tournaments?status=active');
        return res?.data ?? [];
      } catch { return []; }
    },
  });

  // Build a tournament_id → tournament map. Prefer the API response, fall back to
  // whatever was embedded in each matchday so the card always has something.
  const tournamentLookup = useMemo(() => {
    const m = new Map<string, any>();
    for (const t of (tournamentList ?? [])) {
      if (t?.id) m.set(t.id, t);
    }
    return m;
  }, [tournamentList]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        refreshUser(),
        refetchMatchdays(),
        refetchEnrollments(),
        refetchTournamentList(),
        refetchMyTickets(),
      ]);
    } catch {}
    setRefreshing(false);
  };

  // Refetch automático al volver a la pantalla — todas las queries críticas
  useFocusEffect(useCallback(() => {
    refetchMatchdays();
    refetchEnrollments();
    refetchTournamentList();
    refetchMyTickets();
  }, []));

  const getCurrentDate = () => {
    const days   = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
    const months = ['Enero','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
    const now    = new Date();
    return `${days[now.getDay()]}, ${now.getDate()} de ${months[now.getMonth()]}`;
  };

  const firstName = user?.full_name?.split(' ')?.[0] || user?.username || 'Usuario';

  const QUICK_ACTIONS = useMemo(() => {
    const base = [
      { icon: 'football',    label: 'Apuestas',    colors: ['#001A6E','#1A6BFF'] as [string,string], route: '/user/quinielas' },
    ];
    // Polla Final solo visible cuando admin lo activó (setting `polla_final_enabled`)
    if (pollaEnabled) {
      base.push({ icon: 'star', label: 'Polla Final', colors: ['#8B0014','#C8102E'] as [string,string], route: '/user/polla' });
    }
    base.push(
      { icon: 'add-circle',  label: 'Inscribirse',  colors: ['#064E3B','#10B981'] as [string,string], route: '/torneos-inscripcion' },
      { icon: 'person',      label: 'Perfil',       colors: ['#4C1D95','#7C3AED'] as [string,string], route: '/user/perfil'   },
    );
    return base;
  }, [pollaEnabled]);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.bg }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.colors.primaryLight}
          />
        }
      >
        {/* ═══════════════════ HERO ══════════════════════════════════════════ */}
        <LinearGradient
          colors={[theme.colors.primary, theme.colors.primaryLight]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0.8, y: 1 }}
          style={styles.hero}
        >
          {/* Decorative orbs */}
          <View style={styles.orb1} />
          <View style={styles.orb2} />

          <SafeAreaView edges={['top']}>
            <Animated.View entering={FadeIn.duration(480)} style={styles.heroHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.heroGreeting}>Hola, {firstName} 👋</Text>
                <Text style={styles.heroDate}>{getCurrentDate()}</Text>
              </View>
              <Pressable style={styles.heroBell} onPress={() => {}}>
                <Ionicons name="notifications-outline" size={22} color="rgba(255,255,255,0.85)" />
              </Pressable>
            </Animated.View>
          </SafeAreaView>
        </LinearGradient>

        {/* ═══════════════════ STAT CARD (overlaps hero) ═════════════════════ */}
        <Animated.View
          entering={FadeInDown.delay(110).duration(480).springify()}
          style={styles.heroCardOuter}
        >
          <View style={[styles.heroCard, {
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.border,
          }]}>
            <LinearGradient
              colors={[theme.colors.primaryLight, theme.colors.primary, 'transparent']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={styles.heroCardLine}
            />
            <View style={styles.heroCardRow}>
              {/* Total Ganado — premios acumulados en todas las jornadas/torneos.
                  Cambia color a verde cuando hay ganancias para destacar. */}
              <View style={styles.heroCardStat}>
                <View style={[styles.heroCardIcon, {
                  backgroundColor: totalWon > 0 ? '#10B98118' : theme.colors.primaryLight + '18',
                }]}>
                  <Ionicons
                    name={totalWon > 0 ? 'cash' : 'wallet-outline'}
                    size={18}
                    color={totalWon > 0 ? '#10B981' : theme.colors.primaryLight}
                  />
                </View>
                <Text style={[styles.heroCardLabel, { color: theme.colors.textSecondary }]}>Total Ganado</Text>
                <Text style={[styles.heroCardVal, {
                  color: totalWon > 0 ? '#10B981' : theme.colors.textPrimary,
                }]}>
                  {formatCurrency(totalWon)}
                </Text>
              </View>

              <View style={[styles.heroCardDivider, { backgroundColor: theme.colors.border }]} />

              {/* Jornadas */}
              <View style={styles.heroCardStat}>
                <View style={[styles.heroCardIcon, { backgroundColor: '#10B98118' }]}>
                  <Ionicons name="football-outline" size={18} color="#10B981" />
                </View>
                <Text style={[styles.heroCardLabel, { color: theme.colors.textSecondary }]}>Jornadas</Text>
                <Text style={[styles.heroCardVal, { color: theme.colors.textPrimary }]}>
                  {matchdays?.length ?? 0}
                </Text>
              </View>

              <View style={[styles.heroCardDivider, { backgroundColor: theme.colors.border }]} />

              {/* Torneos */}
              <View style={styles.heroCardStat}>
                <View style={[styles.heroCardIcon, { backgroundColor: '#FFD70016' }]}>
                  <Ionicons name="trophy-outline" size={18} color="#FFD700" />
                </View>
                <Text style={[styles.heroCardLabel, { color: theme.colors.textSecondary }]}>Torneos</Text>
                <Text style={[styles.heroCardVal, { color: theme.colors.textPrimary }]}>
                  {enrollments?.length ?? 0}
                </Text>
              </View>
            </View>
          </View>
        </Animated.View>

        {/* ═══════════════════ QUICK ACTIONS ═════════════════════════════════ */}
        <Animated.View entering={FadeInDown.delay(210).duration(380)}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: theme.colors.textPrimary }]}>Acciones</Text>
          </View>
          <View style={styles.quickActionsRow}>
            {QUICK_ACTIONS.map((qa, i) => (
              <QuickAction
                key={qa.label}
                icon={qa.icon}
                label={qa.label}
                colors={qa.colors}
                delay={260 + i * 55}
                onPress={() => router.push(qa.route as any)}
              />
            ))}
          </View>
        </Animated.View>

        {/* ═══════════════════ OPEN MATCHDAYS ════════════════════════════════ */}
        <Animated.View entering={FadeInDown.delay(300).duration(380)} style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: theme.colors.textPrimary }]}>
              Jornadas Abiertas
            </Text>
            {(matchdays?.length ?? 0) > 0 && (
              <View style={[styles.badge, { backgroundColor: theme.colors.primaryLight }]}>
                <Text style={styles.badgeText}>{matchdays.length}</Text>
              </View>
            )}
          </View>

          {matchdaysLoading ? (
            isDesktop ? (
              <View style={styles.mdGrid}>
                {[1, 2, 3].map((i) => (
                  <View key={i} style={[styles.mdGridItem, styles.mdCardSkeleton, {
                    backgroundColor: theme.colors.surface,
                    borderColor: theme.colors.border,
                  }]}>
                    <Skeleton width="100%" height={260} style={{ borderRadius: 18 }} />
                  </View>
                ))}
              </View>
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.carouselPad}
              >
                {[1, 2, 3].map((i) => (
                  <View key={i} style={[styles.mdCard, styles.mdCardSkeleton, {
                    backgroundColor: theme.colors.surface,
                    borderColor: theme.colors.border,
                  }]}>
                    <Skeleton width={260} height={260} style={{ borderRadius: 18 }} />
                  </View>
                ))}
              </ScrollView>
            )
          ) : (matchdays?.length ?? 0) === 0 ? (
            <View style={styles.emptyPad}>
              <EmptyState
                icon="football-outline"
                title="Sin jornadas activas"
                description="Aquí verás las jornadas cuando estén disponibles"
              />
            </View>
          ) : isDesktop ? (
            // ── Desktop: responsive grid that wraps cards (more breathing room)
            <View style={styles.mdGrid}>
              {matchdays.map((md: any, i: number) => {
                const enrichedTournament = tournamentLookup.get(md?.tournament?.id ?? md?.tournament_id) ?? md?.tournament;
                return (
                  <Animated.View
                    key={md.id}
                    entering={FadeInDown.delay(310 + i * 50).duration(340)}
                    style={styles.mdGridItem}
                  >
                    <MatchdayCard
                      matchday={{ ...md, tournament: enrichedTournament }}
                      onPress={() => router.push(`/quiniela/${md.id}` as any)}
                      fullWidth
                    />
                  </Animated.View>
                );
              })}
            </View>
          ) : (
            // ── Mobile: keep horizontal scroll but wider cards
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.carouselPad}
              snapToInterval={272}
              decelerationRate="fast"
            >
              {matchdays.map((md: any, i: number) => {
                const enrichedTournament = tournamentLookup.get(md?.tournament?.id ?? md?.tournament_id) ?? md?.tournament;
                return (
                  <Animated.View
                    key={md.id}
                    entering={FadeInDown.delay(310 + i * 50).duration(340)}
                  >
                    <MatchdayCard
                      matchday={{ ...md, tournament: enrichedTournament }}
                      onPress={() => router.push(`/quiniela/${md.id}` as any)}
                    />
                  </Animated.View>
                );
              })}
            </ScrollView>
          )}
        </Animated.View>

        {/* ═══════════════════ MY TOURNAMENTS ════════════════════════════════ */}
        {(enrollments?.length ?? 0) > 0 && (
          <Animated.View entering={FadeInDown.delay(370).duration(380)} style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: theme.colors.textPrimary }]}>
                Mis Torneos
              </Text>
            </View>
            <View style={styles.tournamentList}>
              {(enrollments ?? []).map((enr: any, i: number) => (
                <Animated.View
                  key={enr.id}
                  entering={FadeInDown.delay(390 + i * 60).duration(320)}
                >
                  <TournamentRow
                    enrollment={enr}
                    colorSet={TOURNAMENT_PALETTES[i % TOURNAMENT_PALETTES.length]}
                    onPress={() => router.push('/user/torneos' as any)}
                  />
                </Animated.View>
              ))}
            </View>
          </Animated.View>
        )}

        <View style={{ height: 120 }} />
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },

  // Hero
  hero: {
    paddingBottom: 56,
    overflow: 'hidden',
  },
  orb1: {
    position: 'absolute',
    width: 320, height: 320,
    borderRadius: 9999,
    top: -120, right: -80,
    backgroundColor: '#1A6BFF',
    opacity: 0.13,
  },
  orb2: {
    position: 'absolute',
    width: 200, height: 200,
    borderRadius: 9999,
    bottom: 10, left: -60,
    backgroundColor: '#7C3AED',
    opacity: 0.16,
  },
  heroHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 22,
  },
  heroGreeting: {
    fontSize: 26,
    fontFamily: fonts.bold,
    color: '#fff',
    letterSpacing: -0.5,
  },
  heroDate: {
    fontSize: 13,
    fontFamily: fonts.regular,
    color: 'rgba(255,255,255,0.55)',
    marginTop: 3,
  },
  heroBell: {
    width: 46, height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Hero stat card (overlapping)
  heroCardOuter: {
    marginTop: -44,
    marginHorizontal: 20,
    zIndex: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 18,
  },
  heroCard: {
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
  },
  heroCardLine: {
    height: 3,
    width: '100%',
  },
  heroCardRow: {
    flexDirection: 'row',
    paddingVertical: 18,
    paddingHorizontal: 6,
  },
  heroCardStat: {
    flex: 1,
    alignItems: 'center',
    gap: 5,
  },
  heroCardIcon: {
    width: 38, height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroCardLabel: {
    fontSize: 11,
    fontFamily: fonts.medium,
  },
  heroCardVal: {
    fontSize: 15,
    fontFamily: fonts.bold,
    letterSpacing: -0.3,
  },
  heroCardDivider: {
    width: 1,
    marginVertical: 10,
  },

  // Quick actions
  quickActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingBottom: 6,
  },
  quickAction: {
    flex: 1,
    alignItems: 'center',
  },
  quickActionGrad: {
    width: 58, height: 58,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  quickActionLabel: {
    fontSize: 11,
    fontFamily: fonts.semibold,
    color: '#7C8DB5',
    textAlign: 'center',
  },

  // Sections
  section: { marginTop: 8 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    marginBottom: 14,
    marginTop: 28,
    gap: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: fonts.bold,
    letterSpacing: -0.3,
  },
  badge: {
    paddingHorizontal: 9,
    paddingVertical: 2,
    borderRadius: 10,
    minWidth: 26,
    alignItems: 'center',
  },
  badgeText: {
    fontSize: 11,
    fontFamily: fonts.bold,
    color: '#fff',
  },

  // Carousel
  carouselPad: {
    paddingHorizontal: 20,
    gap: 12,
    paddingBottom: 4,
  },
  emptyPad: { paddingHorizontal: 24 },

  // Matchday card — mobile (horizontal carousel)
  mdCard: {
    width: 260,
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
  },
  // Desktop: card fills its grid cell
  mdCardFull: {
    width: '100%' as any,
    minWidth: 280,
  },
  // Desktop grid container — wraps cards into responsive columns
  mdGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
    paddingHorizontal: 20,
  },
  // Each grid item — min 320px wide, flex-grows to fill row
  mdGridItem: {
    flexGrow: 1,
    flexBasis: 320,
    minWidth: 280,
    maxWidth: 420,
  },
  mdCardSkeleton: { height: 280 },
  mdCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 6,
  },
  mdCardTournament: {
    fontSize: 11,
    fontFamily: fonts.semibold,
    color: 'rgba(255,255,255,0.85)',
    flex: 1,
  },
  mdCardBody: { padding: 12 },
  mdCardName: {
    fontSize: 15,
    fontFamily: fonts.bold,
    lineHeight: 20,
    letterSpacing: -0.2,
  },
  mdCardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
  },
  mdCardMetaItem: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  mdCardMetaText: { fontSize: 11, fontFamily: fonts.regular },
  mdCardMetaDot: { fontSize: 11 },
  mdCardDivider: {
    height: 1,
    marginVertical: 10,
  },
  mdCardPool: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  mdCardPoolText: {
    fontSize: 13,
    fontFamily: fonts.semibold,
    color: '#10B981',
  },

  // ── Info grid (Inscritos + Apuesta) ────────────────────────────────────────
  mdInfoGrid: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  mdInfoCell: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    gap: 4,
  },
  mdInfoCellTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  mdInfoLabel: {
    fontSize: 10,
    fontFamily: fonts.semibold,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.4,
  },
  mdInfoValue: {
    fontSize: 17,
    fontFamily: fonts.bold,
    letterSpacing: -0.3,
  },
  mdInfoHint: {
    fontSize: 10,
    fontFamily: fonts.regular,
  },

  // ── Pool box ───────────────────────────────────────────────────────────────
  mdPoolBox: {
    marginTop: 10,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  mdPoolRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  mdPoolLabel: {
    fontSize: 11,
    fontFamily: fonts.semibold,
    flex: 1,
  },
  mdPoolValue: {
    fontSize: 15,
    fontFamily: fonts.bold,
    letterSpacing: -0.2,
  },
  mdPoolHint: {
    fontSize: 10,
    fontFamily: fonts.regular,
    marginTop: 4,
    lineHeight: 13,
  },
  mdCardCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    borderRadius: 10,
    marginTop: 10,
    gap: 6,
    overflow: 'hidden',
  },
  mdCardCtaText: {
    fontSize: 12,
    fontFamily: fonts.bold,
    color: '#fff',
  },

  // Tournament list
  tournamentList: {
    paddingHorizontal: 20,
    gap: 10,
  },
  tournamentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    gap: 12,
  },
  tournamentRowIcon: {
    width: 44, height: 44,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tournamentRowName: {
    fontSize: 15,
    fontFamily: fonts.semibold,
    letterSpacing: -0.2,
  },
  tournamentRowSub: {
    fontSize: 12,
    fontFamily: fonts.regular,
    marginTop: 2,
  },
});
