/**
 * GlassCard — tarjeta con efecto vidrio + borde luminoso opcional.
 *
 * Funciona en todas las plataformas con gradiente + borde sutil. Para iOS 26+
 * podrías cambiar el `View` interior por GlassView de expo-glass-effect.
 *
 *  <GlassCard glow="primary" tone="dark">
 *    <Text>Contenido</Text>
 *  </GlassCard>
 *
 * Props:
 *  - glow:   "primary" | "gold" | "success" | "none"  — añade halo de color
 *  - tone:   "dark" | "light"                          — qué tan oscuro el vidrio
 *  - radius: "sm" | "md" | "lg" | "xl"
 */
import React from 'react';
import { View, ViewStyle, StyleProp } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../contexts/ThemeContext';

type Glow   = 'primary' | 'gold' | 'success' | 'none';
type Tone   = 'dark' | 'light';
type Radius = 'sm' | 'md' | 'lg' | 'xl';

interface Props {
  children: React.ReactNode;
  glow?: Glow;
  tone?: Tone;
  radius?: Radius;
  style?: StyleProp<ViewStyle>;
}

const RADII: Record<Radius, number> = { sm: 10, md: 14, lg: 18, xl: 22 };

export function GlassCard({
  children,
  glow = 'none',
  tone = 'dark',
  radius = 'lg',
  style,
}: Props) {
  const { theme } = useTheme();
  const r = RADII[radius];

  const glowColor =
    glow === 'primary' ? theme.colors.primaryLight :
    glow === 'gold'    ? theme.colors.gold :
    glow === 'success' ? theme.colors.success :
    null;

  const borderColor = glowColor ? glowColor + '50' : theme.colors.border;

  return (
    <View
      style={[
        {
          borderRadius: r,
          borderWidth: 1,
          borderColor,
          overflow: 'hidden',
          ...(glowColor ? {
            shadowColor: glowColor,
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.4,
            shadowRadius: 18,
            elevation: 10,
          } : theme.shadows.md),
        },
        style,
      ]}
    >
      <LinearGradient
        colors={
          tone === 'dark'
            ? ['rgba(30,48,80,0.92)', 'rgba(22,37,64,0.96)']
            : ['rgba(255,255,255,0.10)', 'rgba(255,255,255,0.04)']
        }
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={{ flex: 1 }}
      >
        {/* Highlight de luz arriba (efecto cristal) */}
        <LinearGradient
          colors={['rgba(255,255,255,0.08)', 'transparent']}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 60 }}
          pointerEvents="none"
        />
        {children}
      </LinearGradient>
    </View>
  );
}
