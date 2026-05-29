/**
 * PressableScale — wrapper que da feedback táctil premium a cualquier hijo.
 *
 *  <PressableScale onPress={...}>
 *    <Card>...</Card>
 *  </PressableScale>
 *
 * Hace:
 *  - Spring scale 0.96 al presionar (NO 0.5 lineal feo)
 *  - Haptic feedback "light" en touch (iOS+Android)
 *  - Web: opacity sutil (haptic no aplica)
 */
import React from 'react';
import { Pressable, Platform, StyleProp, ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle, useSharedValue, withSpring,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

interface Props {
  children: React.ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
  disabled?: boolean;
  scale?: number;       // default 0.96
  haptic?: 'light' | 'medium' | 'heavy' | 'none';
  style?: StyleProp<ViewStyle>;
}

const SPRING_IN  = { damping: 14, stiffness: 240, mass: 0.6 };
const SPRING_OUT = { damping: 12, stiffness: 180, mass: 0.5 };

export function PressableScale({
  children, onPress, onLongPress, disabled,
  scale = 0.96, haptic = 'light', style,
}: Props) {
  const s = useSharedValue(1);

  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));

  const fireHaptic = () => {
    if (haptic === 'none' || Platform.OS === 'web') return;
    const map = {
      light:  Haptics.ImpactFeedbackStyle.Light,
      medium: Haptics.ImpactFeedbackStyle.Medium,
      heavy:  Haptics.ImpactFeedbackStyle.Heavy,
    };
    Haptics.impactAsync(map[haptic]).catch(() => {});
  };

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      disabled={disabled}
      onPressIn={() => { s.value = withSpring(scale, SPRING_IN); fireHaptic(); }}
      onPressOut={() => { s.value = withSpring(1, SPRING_OUT); }}
    >
      <Animated.View style={[animStyle, disabled && { opacity: 0.5 }, style]}>
        {children}
      </Animated.View>
    </Pressable>
  );
}
