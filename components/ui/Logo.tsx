/**
 * Logo — La llama "Fuego Mundial" del handoff de diseño.
 *
 * Reemplaza el emoji ⚽ que usábamos antes. La llama es el SVG original que
 * el usuario pasó (bosque_logo.svg), renderizada en React Native con
 * react-native-svg y un gradiente oro → ámbar → rojo por defecto.
 *
 * Implementación: aplica fill="url(#gradient)" directamente a los Path
 * (NO usa Mask + Rect — esa combinación falla en react-native-svg-web).
 *
 * Props:
 *   size      — tamaño en px (default 80)
 *   gradient  — array de colores hex para el gradient (default Fuego Mundial)
 *   color     — solid color si NO usas gradient
 *   glow      — añade un drop-shadow ligero del último color del gradient
 *
 * Ejemplos:
 *   <Logo size={120} />                                  // Fuego Mundial default
 *   <Logo size={64} color="#FFFFFF" />                   // negativo blanco
 *   <Logo size={56} gradient={['#60A5FA','#1D4ED8','#B91C1C']} />  // Ignición
 */
import React from 'react';
import Svg, { G, Path, Defs, LinearGradient, Stop } from 'react-native-svg';
import { View, Platform } from 'react-native';

const FLAME_P1 =
  'M1159 1990 c-204 -198 -163 -460 143 -927 183 -280 207 -394 131 -622 -49 -144 -48 -156 8 -103 165 158 245 316 246 487 1 161 -11 183 -239 455 -273 326 -322 478 -227 703 33 77 12 79 -62 7z';
const FLAME_P2 =
  'M818 1439 c-62 -195 -55 -319 27 -488 153 -313 170 -399 92 -450 -141 -93 -317 148 -333 455 -9 172 -13 177 -72 99 -316 -413 83 -1122 534 -951 183 69 262 189 262 399 0 166 -8 184 -208 528 -171 292 -216 384 -230 471 -13 86 -29 72 -72 -63z';

// Paleta del Logo Lab — gradientes disponibles
export const LOGO_GRADIENTS = {
  fire:   ['#FFD700', '#F59E0B', '#DC2626'] as const,            // Fuego Mundial (default)
  ignite: ['#60A5FA', '#2563EB', '#1D4ED8'] as const,            // Ignición — azules
  plasma: ['#FFD700', '#F97316', '#DC2626', '#7C2D12'] as const, // muy caliente
  royal:  ['#3B82F6', '#1D4ED8', '#1E3A8A'] as const,            // azules reales
  duo:    ['#60A5FA', '#1D4ED8', '#B91C1C'] as const,            // azul → rojo
};

let __flameId = 0;

interface LogoProps {
  size?: number;
  /** Array de colores hex. Default = LOGO_GRADIENTS.fire */
  gradient?: readonly string[] | string[] | null;
  /** Solid color si NO se pasa gradient */
  color?: string;
  /** Añade drop-shadow del color final del gradient (solo web) */
  glow?: boolean;
  style?: any;
}

export function Logo({
  size = 80,
  gradient = LOGO_GRADIENTS.fire,
  color = '#0A1020',
  glow = false,
  style,
}: LogoProps) {
  // ID único por instancia (evita colisiones cuando hay varios Logos en pantalla)
  const id = React.useMemo(() => ++__flameId, []);
  const gid = `flame-grad-${id}`;

  // El glow solo aplica en web (CSS filter). En native no soporta drop-shadow.
  const glowStyle =
    glow && Platform.OS === 'web' && gradient
      ? {
          // @ts-ignore web-only style
          filter: `drop-shadow(0 6px 16px ${gradient[gradient.length - 1]}66)`,
        }
      : undefined;

  // El fill aplicado a los Path: si hay gradient usamos url(#gid), sino solid color
  const fillRef = gradient && gradient.length > 0 ? `url(#${gid})` : color;

  return (
    <View style={[glowStyle, style]}>
      <Svg width={size} height={size} viewBox="0 0 143 143">
        {gradient && gradient.length > 0 && (
          <Defs>
            {/* x1/y1/x2/y2 son fracciones del bounding box */}
            <LinearGradient id={gid} x1="0" y1="0" x2="0.45" y2="1">
              {gradient.map((c, i) => (
                <Stop
                  key={i}
                  offset={`${(i / Math.max(1, gradient.length - 1)) * 100}%`}
                  stopColor={c}
                />
              ))}
            </LinearGradient>
          </Defs>
        )}
        {/* Los paths originales del SVG vienen en un viewport con coordenadas
            invertidas y escala 0.066667. Mantenemos el mismo transform que
            el SVG original. El gradient se aplica directamente al fill. */}
        <G transform="translate(0,143) scale(0.066667,-0.066667)" fill={fillRef}>
          <Path d={FLAME_P1} fill={fillRef} />
          <Path d={FLAME_P2} fill={fillRef} />
        </G>
      </Svg>
    </View>
  );
}

export default Logo;
