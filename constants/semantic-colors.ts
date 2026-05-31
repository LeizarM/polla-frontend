/**
 * semantic-colors — paleta semántica para badges, chips y estados.
 *
 * Estos colores NO viven en `palettes.ts` porque son constantes (no cambian
 * entre paletas). Útiles para:
 *   - Success / warning / error states
 *   - Badges de gold (winner, top), silver, bronze
 *   - Fondos "soft" (translucidos) para chips
 *
 * Origen: design_handoff_dia_claro/tokens.js (tema Día Claro del handoff).
 *
 * Uso en componentes:
 *   import { semantic } from '../constants/semantic-colors';
 *   <View style={{ backgroundColor: semantic.successSoft }}>
 *     <Text style={{ color: semantic.success }}>OK</Text>
 *   </View>
 */
export const semantic = {
  // ── Estados ────────────────────────────────────────────────────────
  success:     '#059669',
  successSoft: '#D1FAE5',
  warning:     '#D97706',
  warningSoft: '#FEF3C7',
  error:       '#DC2626',
  errorSoft:   '#FEE2E2',
  info:        '#2563EB',
  infoSoft:    '#DBEAFE',

  // ── Premios / posiciones ───────────────────────────────────────────
  gold:        '#CA8A04',
  goldSoft:    '#FEF3C7',
  silver:      '#64748B',
  silverSoft:  '#F1F5F9',
  bronze:      '#92400E',
  bronzeSoft:  '#FED7AA',

  // ── Soft fills para "primary" y "accent" sobre claro ───────────────
  primarySoft: '#DBEAFE',
  accentSoft:  '#FEE2E2',

  // ── Border / divisor suave (más suave que el border de la paleta) ──
  borderSoft:  '#E2E8F0',

  // ── White (para usar en gradients oscuros) ─────────────────────────
  onDark:      '#FFFFFF',
} as const;

// Type-safe access
export type SemanticColor = keyof typeof semantic;
