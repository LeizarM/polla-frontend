/**
 * TabBar — Premium mobile bottom nav con overflow inteligente
 *
 *  - ≤ 5 tabs visibles  → muestra todos.
 *  - > 5 tabs           → 4 + "Más" (abre bottom sheet con el resto).
 *  - Labels y iconos escalan con el ancho de pantalla.
 *  - Safe area dinámico (notch / home indicator iPhone).
 */
import React, { memo, useState, useMemo } from 'react';
import {
  View, Text, Pressable, Platform, StyleSheet, Modal, ScrollView, useWindowDimensions,
} from 'react-native';
import Animated, {
  FadeIn, FadeOut, SlideInDown, SlideOutDown,
  useAnimatedStyle, useSharedValue, withSpring, withTiming, interpolate,
} from 'react-native-reanimated';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';
import * as Haptics from 'expo-haptics';

const SPRING = { damping: 14, stiffness: 180, mass: 0.8 };
const MAX_VISIBLE_TABS = 5;   // tabs visibles antes de colapsar en "Más"
const PRIMARY_TABS     = 4;   // si hay overflow, cuántos quedan a la izquierda

export function TabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets  = useSafeAreaInsets();
  const { theme } = useTheme();
  const { width } = useWindowDimensions();
  const [moreOpen, setMoreOpen] = useState(false);

  const visibleRoutes = useMemo(() =>
    state.routes.filter((route) => {
      const { options } = descriptors[route.key] ?? {};
      if ((options as any)?.href === null) return false;
      if (!options?.title && !options?.tabBarIcon && !options?.tabBarLabel) return false;
      return true;
    }),
    [state.routes, descriptors]
  );

  const needsOverflow = visibleRoutes.length > MAX_VISIBLE_TABS;
  const primary  = needsOverflow ? visibleRoutes.slice(0, PRIMARY_TABS) : visibleRoutes;
  const overflow = needsOverflow ? visibleRoutes.slice(PRIMARY_TABS)    : [];

  // Si alguna ruta del overflow está enfocada, el botón "Más" se marca activo
  const overflowFocused = overflow.some(r => state.routes.indexOf(r) === state.index);

  // Escala label/icono según ancho real disponible
  const tabCount    = primary.length + (needsOverflow ? 1 : 0);
  const tabWidth    = (width - 8) / Math.max(tabCount, 1);
  const compact     = tabWidth < 70;             // celulares pequeños
  const labelSize   = compact ? 9 : 9.5;
  const iconSize    = compact ? 20 : 22;

  const goToRoute = (routeKey: string, routeName: string) => {
    const event = navigation.emit({
      type: 'tabPress',
      target: routeKey,
      canPreventDefault: true,
    });
    const realIndex = state.routes.findIndex(r => r.key === routeKey);
    if (state.index !== realIndex && !event.defaultPrevented) {
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      }
      navigation.navigate(routeName);
    }
  };

  return (
    <>
      <View
        style={[
          styles.wrapper,
          {
            // iPhone con home indicator: insets.bottom ~34px. Sin notch: 0 → 8.
            paddingBottom: Math.max(insets.bottom, 8),
            backgroundColor: theme.colors.surface,
            borderTopColor: theme.colors.border,
          },
        ]}
      >
        <LinearGradient
          colors={[theme.colors.primaryLight + '40', 'transparent']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          style={styles.topLine}
          pointerEvents="none"
        />

        <View style={styles.row}>
          {primary.map((route) => {
            const realIndex = state.routes.indexOf(route);
            const { options } = descriptors[route.key] ?? {};
            const label =
              typeof options?.tabBarLabel === 'string'
                ? options.tabBarLabel
                : options?.title ?? route.name;
            const isFocused = state.index === realIndex;
            const icon = options?.tabBarIcon as any;
            const activeColor   = (options as any)?.tabBarActiveTintColor ?? theme.colors.primaryLight;

            return (
              <TabBarItem
                key={route.key}
                label={label}
                renderIcon={(props) => icon?.(props)}
                isFocused={isFocused}
                onPress={() => goToRoute(route.key, route.name)}
                activeColor={activeColor}
                inactiveColor={theme.colors.textMuted}
                pillBg={theme.colors.primaryLight + '18'}
                labelSize={labelSize}
                iconSize={iconSize}
              />
            );
          })}

          {needsOverflow && (
            <TabBarItem
              label="Más"
              renderIcon={({ color, size }) => (
                <Ionicons name={moreOpen || overflowFocused ? 'menu' : 'menu-outline'} size={size} color={color} />
              )}
              isFocused={overflowFocused}
              onPress={() => setMoreOpen(true)}
              activeColor={theme.colors.primaryLight}
              inactiveColor={theme.colors.textMuted}
              pillBg={theme.colors.primaryLight + '18'}
              labelSize={labelSize}
              iconSize={iconSize}
            />
          )}
        </View>
      </View>

      {/* ── Bottom sheet con las tabs del overflow ──────────────────── */}
      <Modal visible={moreOpen} transparent animationType="none" onRequestClose={() => setMoreOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setMoreOpen(false)}>
          <Animated.View
            entering={FadeIn.duration(180)}
            exiting={FadeOut.duration(150)}
            style={StyleSheet.absoluteFill}
          />
        </Pressable>

        <Animated.View
          entering={SlideInDown.springify().damping(16).mass(0.8)}
          exiting={SlideOutDown.duration(180)}
          style={[
            styles.sheet,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
              paddingBottom: Math.max(insets.bottom, 16),
            },
          ]}
        >
          <View style={styles.sheetHandle} />
          <Text style={[styles.sheetTitle, { color: theme.colors.textPrimary }]}>Más opciones</Text>

          <ScrollView style={{ maxHeight: 360 }}>
            {overflow.map((route) => {
              const realIndex = state.routes.indexOf(route);
              const { options } = descriptors[route.key] ?? {};
              const label =
                typeof options?.tabBarLabel === 'string'
                  ? options.tabBarLabel
                  : options?.title ?? route.name;
              const isFocused = state.index === realIndex;
              const icon = options?.tabBarIcon as any;

              return (
                <Pressable
                  key={route.key}
                  onPress={() => {
                    setMoreOpen(false);
                    // pequeño delay para que la animación de cierre se vea bonita
                    setTimeout(() => goToRoute(route.key, route.name), 60);
                  }}
                  style={({ pressed }) => [
                    styles.sheetRow,
                    {
                      backgroundColor:
                        isFocused
                          ? theme.colors.primaryLight + '15'
                          : pressed
                            ? theme.colors.border + '40'
                            : 'transparent',
                      borderColor:
                        isFocused ? theme.colors.primaryLight + '50' : 'transparent',
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.sheetIconWrap,
                      {
                        backgroundColor: isFocused
                          ? theme.colors.primaryLight + '25'
                          : theme.colors.inputBg,
                      },
                    ]}
                  >
                    {icon?.({
                      focused: isFocused,
                      color: isFocused ? theme.colors.primaryLight : theme.colors.textSecondary,
                      size: 22,
                    })}
                  </View>
                  <Text
                    style={[
                      styles.sheetLabel,
                      {
                        color: isFocused ? theme.colors.primaryLight : theme.colors.textPrimary,
                        fontFamily: isFocused ? 'Poppins_700Bold' : 'Poppins_500Medium',
                      },
                    ]}
                  >
                    {label}
                  </Text>
                  {isFocused && (
                    <Ionicons name="checkmark-circle" size={20} color={theme.colors.primaryLight} />
                  )}
                </Pressable>
              );
            })}
          </ScrollView>
        </Animated.View>
      </Modal>
    </>
  );
}

// ─── Item ─────────────────────────────────────────────────────────────────────
interface TabBarItemProps {
  label: string;
  renderIcon: (props: { focused: boolean; color: string; size: number }) => React.ReactNode;
  isFocused: boolean;
  onPress: () => void;
  activeColor: string;
  inactiveColor: string;
  pillBg: string;
  labelSize: number;
  iconSize: number;
}

const TabBarItem = memo(function TabBarItem({
  label, renderIcon, isFocused, onPress, activeColor, inactiveColor, pillBg, labelSize, iconSize,
}: TabBarItemProps) {
  const scale    = useSharedValue(1);
  const pillAnim = useSharedValue(isFocused ? 1 : 0);

  React.useEffect(() => {
    pillAnim.value = withTiming(isFocused ? 1 : 0, { duration: 200 });
  }, [isFocused]);

  const scaleStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const pillStyle  = useAnimatedStyle(() => ({
    opacity: pillAnim.value,
    transform: [{ scaleX: interpolate(pillAnim.value, [0, 1], [0.6, 1]) }],
  }));

  const color = isFocused ? activeColor : inactiveColor;

  return (
    <Pressable
      style={styles.tab}
      onPress={onPress}
      onPressIn={() => { scale.value = withSpring(0.88, SPRING); }}
      onPressOut={() => { scale.value = withSpring(1, SPRING); }}
      accessibilityRole="tab"
      accessibilityState={{ selected: isFocused }}
    >
      <Animated.View style={[styles.tabInner, scaleStyle]}>
        <View style={[styles.iconWrap, { width: iconSize + 22, height: iconSize + 10 }]}>
          <Animated.View
            style={[StyleSheet.absoluteFill, { backgroundColor: pillBg, borderRadius: 12 }, pillStyle]}
          />
          {renderIcon({ focused: isFocused, color, size: iconSize })}
        </View>
        <Text
          numberOfLines={1}
          style={[
            styles.label,
            {
              color,
              fontSize: labelSize,
              fontFamily: isFocused ? 'Poppins_700Bold' : 'Poppins_400Regular',
            },
          ]}
        >
          {label}
        </Text>
      </Animated.View>
    </Pressable>
  );
});

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  wrapper: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  topLine: {
    height: 1, width: '100%',
  },
  row: {
    flexDirection: 'row',
    paddingTop: 6,
    paddingHorizontal: 4,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
  },
  tabInner: {
    alignItems: 'center',
    paddingVertical: 4,
    width: '100%',
  },
  iconWrap: {
    borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 3,
    overflow: 'hidden',
  },
  label: {
    letterSpacing: 0.2,
    textAlign: 'center',
    maxWidth: 70,
  },
  // ── Bottom sheet ────────────────────────────────────────────────
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    position: 'absolute',
    left: 0, right: 0, bottom: 0,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    paddingTop: 8,
    paddingHorizontal: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.25, shadowRadius: 16,
    elevation: 20,
  },
  sheetHandle: {
    width: 44, height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignSelf: 'center',
    marginBottom: 8,
  },
  sheetTitle: {
    fontSize: 14,
    fontFamily: 'Poppins_700Bold',
    letterSpacing: -0.2,
    textAlign: 'center',
    marginBottom: 10,
  },
  sheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 4,
  },
  sheetIconWrap: {
    width: 40, height: 40, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  sheetLabel: {
    flex: 1,
    fontSize: 14,
    letterSpacing: -0.1,
  },
});
