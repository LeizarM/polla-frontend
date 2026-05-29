/**
 * AnimatedCounter — números que cuentan hacia arriba (efecto wow).
 *
 *  <AnimatedCounter value={1234} formatter={v => `Bs ${v}`} duration={900} />
 *
 * Patrones premium:
 *  - Spring-like (no lineal): rápido al inicio, suave al final.
 *  - Format-aware: usas tu formatMoney() o lo que quieras.
 *  - Sin "0 1 2 3..." plano: usa ease-out cubic.
 */
import React, { useEffect, useState } from 'react';
import { Text, TextStyle, StyleProp } from 'react-native';
import Animated, {
  useAnimatedReaction,
  useSharedValue,
  withTiming,
  runOnJS,
  Easing,
} from 'react-native-reanimated';

interface Props {
  value: number;
  duration?: number;
  formatter?: (n: number) => string;
  style?: StyleProp<TextStyle>;
  startFromZero?: boolean;
}

export function AnimatedCounter({
  value,
  duration = 900,
  formatter = (n) => Math.round(n).toLocaleString('es'),
  style,
  startFromZero = true,
}: Props) {
  const sv = useSharedValue(startFromZero ? 0 : value);
  const [display, setDisplay] = useState(formatter(startFromZero ? 0 : value));

  useEffect(() => {
    sv.value = withTiming(value, {
      duration,
      easing: Easing.out(Easing.cubic),
    });
  }, [value, duration, sv]);

  useAnimatedReaction(
    () => sv.value,
    (cur) => {
      runOnJS(setDisplay)(formatter(cur));
    },
    [formatter],
  );

  return <Animated.Text style={style}>{display}</Animated.Text>;
}
