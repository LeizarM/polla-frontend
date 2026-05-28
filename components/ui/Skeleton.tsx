import React, { useEffect, useMemo } from 'react';
import { View, StyleSheet, ViewStyle, DimensionValue } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { useTheme } from '../../contexts/ThemeContext';
import { theme as staticTheme } from '../../constants/theme';

type SkeletonShape = 'rect' | 'circle' | 'text';

interface SkeletonProps {
  width?: DimensionValue;
  height?: number;
  shape?: SkeletonShape;
  borderRadius?: number;
  style?: ViewStyle;
}

export function Skeleton({
  width = '100%',
  height = 20,
  shape = 'rect',
  borderRadius,
  style,
}: SkeletonProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const translateX = useSharedValue(-300);

  useEffect(() => {
    translateX.value = withRepeat(
      withTiming(300, {
        duration: 1500,
        easing: Easing.bezier(0.25, 0.1, 0.25, 1),
      }),
      -1,
      false
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const getShape = (): ViewStyle => {
    if (shape === 'circle') {
      return {
        width: height,
        height: height,
        borderRadius: height / 2,
      };
    }
    if (shape === 'text') {
      return {
        width,
        height: height || 16,
        borderRadius: staticTheme.radius.sm,
      };
    }
    return {
      width,
      height,
      borderRadius: borderRadius ?? staticTheme.radius.md,
    };
  };

  return (
    <View
      style={[
        styles.skeleton,
        getShape(),
        style,
      ]}
    >
      <Animated.View style={[styles.shimmer, animatedStyle]}>
        <LinearGradient
          colors={[
            theme.colors.surfaceElevated,
            theme.colors.border,
            theme.colors.surfaceElevated,
          ]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.gradient}
        />
      </Animated.View>
    </View>
  );
}

function makeStyles(t: typeof staticTheme) {
  return StyleSheet.create({
    skeleton: {
      backgroundColor: t.colors.surfaceElevated,
      overflow: 'hidden',
    },
    shimmer: {
      width: '100%',
      height: '100%',
    },
    gradient: {
      width: 300,
      height: '100%',
    },
  });
}
