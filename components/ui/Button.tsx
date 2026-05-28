/**
 * Button — NativeWind + CVA + Reanimated
 *
 * Variants: primary | accent | outline | ghost
 * Sizes:    sm | md | lg
 * Features: gradient backgrounds, haptic feedback, scale press animation,
 *           loading state, icon support (left/right), full-width option.
 */
import React from 'react';
import {
  Pressable,
  Text,
  ActivityIndicator,
  ViewStyle,
  Platform,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../utils/cn';
import { useTheme } from '../../contexts/ThemeContext';

// ─── CVA variants ──────────────────────────────────────────────────────────────

const buttonVariants = cva(
  // Base classes — shared by all variants
  'flex-row items-center justify-center rounded-xl overflow-hidden',
  {
    variants: {
      variant: {
        primary: '',           // Uses LinearGradient → no bg class needed
        accent:  '',           // Uses LinearGradient → no bg class needed
        outline: 'bg-transparent border border-border',
        ghost:   'bg-transparent',
      },
      size: {
        sm: 'h-9  px-md',     // h-9 = 36px
        md: 'h-12 px-lg',     // h-12 = 48px
        lg: 'h-14 px-lg',     // h-14 = 56px
      },
      fullWidth: {
        true:  'w-full',
        false: '',
      },
      disabled: {
        true:  'opacity-40',
        false: '',
      },
    },
    defaultVariants: {
      variant:   'primary',
      size:      'md',
      fullWidth: false,
      disabled:  false,
    },
  },
);

const textVariants = cva(
  'font-bold',
  {
    variants: {
      variant: {
        primary: 'text-white',
        accent:  'text-white',
        outline: 'text-text-primary',
        ghost:   'text-text-primary',
      },
      size: {
        sm: 'text-sm',
        md: 'text-body',
        lg: 'text-body',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size:    'md',
    },
  },
);

// ─── Spring config ─────────────────────────────────────────────────────────────

const SPRING = { damping: 15, stiffness: 150 };

// ─── Props ─────────────────────────────────────────────────────────────────────

type ButtonVariantProps = VariantProps<typeof buttonVariants>;

interface ButtonProps extends Omit<ButtonVariantProps, 'disabled'> {
  title: string;
  onPress?: () => void;
  loading?: boolean;
  disabled?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  iconPosition?: 'left' | 'right';
  style?: ViewStyle;
  className?: string;
}

// ─── Component ─────────────────────────────────────────────────────────────────

export function Button({
  title,
  onPress,
  variant   = 'primary',
  size      = 'md',
  loading   = false,
  disabled  = false,
  fullWidth = false,
  icon,
  iconPosition = 'left',
  style,
  className,
}: ButtonProps) {
  const { theme } = useTheme();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.96, SPRING);
  };
  const handlePressOut = () => {
    scale.value = withSpring(1, SPRING);
  };
  const handlePress = () => {
    if (disabled || loading) return;
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onPress?.();
  };

  const iconSizes = { sm: 16, md: 20, lg: 22 };
  const iconColor = (variant === 'primary' || variant === 'accent') ? '#fff' : theme.colors.textPrimary;

  const containerClass = cn(
    buttonVariants({ variant, size, fullWidth, disabled }),
    className,
  );
  const labelClass = textVariants({ variant, size });

  const renderContent = () => {
    if (loading) {
      return <ActivityIndicator color={iconColor} size="small" />;
    }
    return (
      <>
        {icon && iconPosition === 'left' && (
          <Ionicons
            name={icon}
            size={iconSizes[size ?? 'md']}
            color={iconColor}
            style={{ marginRight: 8 }}
          />
        )}
        <Text className={labelClass}>{title}</Text>
        {icon && iconPosition === 'right' && (
          <Ionicons
            name={icon}
            size={iconSizes[size ?? 'md']}
            color={iconColor}
            style={{ marginLeft: 8 }}
          />
        )}
      </>
    );
  };

  const isDisabled = disabled || loading;

  // ── Gradient variants (primary / accent) ──────────────────────────────────

  if (variant === 'primary' || variant === 'accent') {
    const gradientColors = variant === 'primary'
      ? theme.gradients.primary
      : theme.gradients.accent;

    return (
      <Animated.View
        style={[animatedStyle, fullWidth && { width: '100%' }, style]}
      >
        <Pressable
          onPress={handlePress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          disabled={isDisabled}
          className={containerClass}
        >
          <LinearGradient
            colors={gradientColors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            className={cn(
              'flex-row items-center justify-center w-full',
              size === 'sm' && 'h-9  px-md',
              size === 'md' && 'h-12 px-lg',
              size === 'lg' && 'h-14 px-lg',
              isDisabled && 'opacity-40',
            )}
          >
            {renderContent()}
          </LinearGradient>
        </Pressable>
      </Animated.View>
    );
  }

  // ── Flat variants (outline / ghost) ───────────────────────────────────────

  return (
    <Animated.View
      style={[animatedStyle, fullWidth && { width: '100%' }, style]}
    >
      <Pressable
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={isDisabled}
        className={containerClass}
      >
        {renderContent()}
      </Pressable>
    </Animated.View>
  );
}
