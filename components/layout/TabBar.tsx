/**
 * TabBar — Premium mobile bottom nav
 * Pill background on active tab · spring scale · haptics · blur backdrop
 */
import React, { memo } from 'react';
import { View, Text, Pressable, Platform, StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  interpolate,
} from 'react-native-reanimated';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../contexts/ThemeContext';
import * as Haptics from 'expo-haptics';

const SPRING = { damping: 14, stiffness: 180, mass: 0.8 };

export function TabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets  = useSafeAreaInsets();
  const { theme } = useTheme();

  const visibleRoutes = state.routes.filter((route) => {
    const { options } = descriptors[route.key] ?? {};
    if ((options as any)?.href === null) return false;
    if (!options?.title && !options?.tabBarIcon && !options?.tabBarLabel) return false;
    return true;
  });

  return (
    <View
      style={[
        styles.wrapper,
        {
          paddingBottom: Math.max(insets.bottom, 8),
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.border,
        },
      ]}
    >
      {/* Subtle top gradient line */}
      <LinearGradient
        colors={[theme.colors.primaryLight + '40', 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.topLine}
        pointerEvents="none"
      />

      <View style={styles.row}>
        {visibleRoutes.map((route) => {
          const realIndex = state.routes.indexOf(route);
          const { options } = descriptors[route.key] ?? {};
          const label =
            typeof options?.tabBarLabel === 'string'
              ? options.tabBarLabel
              : options?.title ?? route.name;
          const isFocused = state.index === realIndex;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!isFocused && !event.defaultPrevented) {
              if (Platform.OS !== 'web') {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              }
              navigation.navigate(route.name);
            }
          };

          const icon = options?.tabBarIcon as any;
          const activeColor = (options as any)?.tabBarActiveTintColor ?? theme.colors.primaryLight;

          return (
            <TabBarItem
              key={route.key}
              label={label}
              icon={icon}
              isFocused={isFocused}
              onPress={onPress}
              activeColor={activeColor}
              inactiveColor={theme.colors.textMuted}
              pillBg={theme.colors.primaryLight + '18'}
            />
          );
        })}
      </View>
    </View>
  );
}

// ─── Item ─────────────────────────────────────────────────────────────────────

interface TabBarItemProps {
  label: string;
  icon: (props: { focused: boolean; color: string; size: number }) => React.ReactNode;
  isFocused: boolean;
  onPress: () => void;
  activeColor: string;
  inactiveColor: string;
  pillBg: string;
}

const TabBarItem = memo(function TabBarItem({
  label, icon, isFocused, onPress, activeColor, inactiveColor, pillBg,
}: TabBarItemProps) {
  const scale    = useSharedValue(1);
  const pillAnim = useSharedValue(isFocused ? 1 : 0);

  React.useEffect(() => {
    pillAnim.value = withTiming(isFocused ? 1 : 0, { duration: 200 });
  }, [isFocused]);

  const handlePressIn  = () => { scale.value = withSpring(0.88, SPRING); };
  const handlePressOut = () => { scale.value = withSpring(1,    SPRING); };

  const scaleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const pillStyle = useAnimatedStyle(() => ({
    opacity:           pillAnim.value,
    transform: [{ scaleX: interpolate(pillAnim.value, [0, 1], [0.6, 1]) }],
  }));

  const color = isFocused ? activeColor : inactiveColor;

  return (
    <Pressable
      style={styles.tab}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      accessibilityRole="tab"
      accessibilityState={{ selected: isFocused }}
    >
      <Animated.View style={[styles.tabInner, scaleStyle]}>
        {/* Pill background */}
        <View style={styles.iconWrap}>
          <Animated.View
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: pillBg, borderRadius: 12 },
              pillStyle,
            ]}
          />
          {icon?.({ focused: isFocused, color, size: 22 })}
        </View>

        <Text
          numberOfLines={1}
          style={[
            styles.label,
            {
              color,
              fontWeight: isFocused ? '700' : '400',
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
    height: 1,
    width: '100%',
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
    width: 44,
    height: 32,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 3,
    overflow: 'hidden',
  },
  label: {
    fontSize: 9.5,
    letterSpacing: 0.2,
    textAlign: 'center',
    maxWidth: 64,
  },
});
