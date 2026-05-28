/**
 * Card — NativeWind + CVA + Reanimated
 *
 * Variants: default | glow | glass
 * Features: optional press handler with scale animation + haptic,
 *           optional colored accent bar on the left edge,
 *           className prop for one-off overrides.
 */
import React from 'react';
import { Pressable, View, ViewStyle, Platform } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../utils/cn';

// ─── CVA variants ──────────────────────────────────────────────────────────────

const cardVariants = cva(
  // Base — all cards
  'rounded-lg overflow-hidden',
  {
    variants: {
      variant: {
        default: 'bg-surface border border-border',
        glow:    'bg-surface border border-border-glow shadow-glow',
        glass:   'bg-surface-glass border border-border',
      },
      padding: {
        none: '',
        sm:   'p-sm',
        md:   'p-md',
        lg:   'p-lg',
      },
    },
    defaultVariants: {
      variant: 'default',
      padding: 'md',
    },
  },
);

// ─── Props ─────────────────────────────────────────────────────────────────────

type CardVariantProps = VariantProps<typeof cardVariants>;

interface CardProps extends CardVariantProps {
  children: React.ReactNode;
  onPress?: () => void;
  accentColor?: string;   // Left border accent (e.g. success, gold, accent)
  style?: ViewStyle;
  className?: string;
}

const SPRING = { damping: 20, stiffness: 200 };

// ─── Component ─────────────────────────────────────────────────────────────────

export function Card({
  children,
  variant  = 'default',
  padding  = 'md',
  onPress,
  accentColor,
  style,
  className,
}: CardProps) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    if (!onPress) return;
    scale.value = withSpring(0.975, SPRING);
  };
  const handlePressOut = () => {
    if (!onPress) return;
    scale.value = withSpring(1, SPRING);
  };
  const handlePress = () => {
    if (!onPress) return;
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onPress();
  };

  const cardClass = cn(cardVariants({ variant, padding }), className);

  const inner = (
    <View className={cardClass} style={style}>
      {/* Optional left accent bar */}
      {accentColor && (
        <View
          className="absolute left-0 top-0 bottom-0 w-1 rounded-l-lg"
          style={{ backgroundColor: accentColor }}
        />
      )}
      <View className={accentColor ? 'pl-sm' : ''}>{children}</View>
    </View>
  );

  if (!onPress) return <Animated.View style={animatedStyle}>{inner}</Animated.View>;

  return (
    <Animated.View style={animatedStyle}>
      <Pressable
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
      >
        {inner}
      </Pressable>
    </Animated.View>
  );
}
