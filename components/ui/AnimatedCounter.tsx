/**
 * AnimatedCounter — números que cuentan hacia arriba (efecto wow).
 *
 *  <AnimatedCounter value={1234} formatter={v => `Bs ${v}`} duration={900} />
 *
 * IMPLEMENTACIÓN 100% JS (sin react-native-reanimated / worklets).
 * Motivo: en el APK release con New Architecture, los worklets de reanimated
 * son una fuente común de crashes nativos. Este contador usa setInterval +
 * ease-out cúbico — robusto en CUALQUIER arquitectura y versión de Android.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Text, TextStyle, StyleProp } from 'react-native';

interface Props {
  value: number;
  duration?: number;
  formatter?: (n: number) => string;
  style?: StyleProp<TextStyle>;
  startFromZero?: boolean;
}

// Formatter por defecto SIN toLocaleString('es') — Hermes en Android puede
// no soportar el argumento de locale. Separador de miles manual.
function defaultFormat(n: number): string {
  const r = Math.round(n);
  return String(r).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

export function AnimatedCounter({
  value,
  duration = 900,
  formatter = defaultFormat,
  style,
  startFromZero = true,
}: Props) {
  const [display, setDisplay] = useState<number>(startFromZero ? 0 : value);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fromRef = useRef<number>(startFromZero ? 0 : value);

  useEffect(() => {
    const from = fromRef.current;
    const to = Number.isFinite(value) ? value : 0;

    // Si no hay cambio, fija el valor directo
    if (from === to) {
      setDisplay(to);
      return;
    }

    const steps = 30;
    const interval = Math.max(16, Math.floor(duration / steps));
    let i = 0;

    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      i += 1;
      const t = Math.min(1, i / steps);
      const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
      const cur = from + (to - from) * eased;
      if (t >= 1) {
        if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = null;
        fromRef.current = to;
        setDisplay(to);
      } else {
        setDisplay(cur);
      }
    }, interval);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [value, duration]);

  let text: string;
  try {
    text = formatter(display);
  } catch {
    text = String(Math.round(display));
  }

  return <Text style={style}>{text}</Text>;
}
