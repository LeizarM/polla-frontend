export interface ColorPalette {
  id: string;
  name: string;
  emoji: string;
  colors: {
    bg: string;
    surface: string;
    surfaceElevated: string;
    surfaceGlass: string;
    border: string;
    borderGlow: string;
    primary: string;
    primaryLight: string;
    accent: string;
    accentLight: string;
    textPrimary: string;
    textSecondary: string;
    textMuted: string;
    inputBg: string;
  };
  gradients: {
    primary: [string, string];
    accent: [string, string];
    card: [string, string];
    balance: [string, string];
    dark: [string, string];
  };
  shadowColor: string;
}

export const PALETTES: ColorPalette[] = [
  // ── NEW DEFAULT: noticeably lighter dark navy ──────────────────────────────
  {
    id: 'mundial',
    name: 'Mundial Clásico',
    emoji: '⚽',
    colors: {
      bg:              '#0D1B2E',   // dark navy (was near-black #0A0E1A)
      surface:         '#162540',   // medium navy
      surfaceElevated: '#1E3050',
      surfaceGlass:    'rgba(22,37,64,0.88)',
      border:          '#2A4060',
      borderGlow:      '#3B82F6',
      primary:         '#1D4ED8',
      primaryLight:    '#3B82F6',   // brighter blue
      accent:          '#E11D48',
      accentLight:     '#FB4570',
      textPrimary:     '#F1F5FF',
      textSecondary:   '#94A3B8',   // much lighter secondary (was #8892A8)
      textMuted:       '#546882',
      inputBg:         '#1A2E4A',
    },
    gradients: {
      primary:  ['#1D4ED8', '#3B82F6'],
      accent:   ['#BE123C', '#E11D48'],
      card:     ['rgba(30,48,80,0.92)', 'rgba(22,37,64,0.96)'],
      balance:  ['#1D4ED8', '#3B82F6'],
      dark:     ['#0D1B2E', '#162540'],
    },
    shadowColor: '#3B82F6',
  },

  // ── DÍA CLARO: true light theme ───────────────────────────────────────────
  {
    id: 'claro',
    name: 'Día Claro',
    emoji: '☀️',
    colors: {
      bg:              '#F0F4F8',
      surface:         '#FFFFFF',
      surfaceElevated: '#E8EFF7',
      surfaceGlass:    'rgba(255,255,255,0.92)',
      border:          '#CBD5E1',
      borderGlow:      '#2563EB',
      primary:         '#1D4ED8',
      primaryLight:    '#2563EB',
      accent:          '#DC2626',
      accentLight:     '#EF4444',
      textPrimary:     '#0F172A',
      textSecondary:   '#475569',
      textMuted:       '#94A3B8',
      inputBg:         '#F8FAFC',
    },
    gradients: {
      primary:  ['#1D4ED8', '#2563EB'],
      accent:   ['#B91C1C', '#DC2626'],
      card:     ['rgba(232,239,247,0.95)', 'rgba(255,255,255,0.98)'],
      balance:  ['#1D4ED8', '#3B82F6'],
      dark:     ['#E2E8F0', '#F0F4F8'],
    },
    shadowColor: '#2563EB',
  },

  // ── OCEANO ────────────────────────────────────────────────────────────────
  {
    id: 'oceano',
    name: 'Océano',
    emoji: '🌊',
    colors: {
      bg:              '#080E14',
      surface:         '#101D28',
      surfaceElevated: '#182C3A',
      surfaceGlass:    'rgba(16,29,40,0.85)',
      border:          '#1E3A50',
      borderGlow:      '#06B6D4',
      primary:         '#0E7490',
      primaryLight:    '#06B6D4',
      accent:          '#8B5CF6',
      accentLight:     '#A78BFA',
      textPrimary:     '#ECFEFF',
      textSecondary:   '#67E8F9',
      textMuted:       '#3B5F70',
      inputBg:         '#142530',
    },
    gradients: {
      primary:  ['#0E7490', '#06B6D4'],
      accent:   ['#7C3AED', '#8B5CF6'],
      card:     ['rgba(24,44,58,0.9)', 'rgba(16,29,40,0.95)'],
      balance:  ['#0E7490', '#06B6D4'],
      dark:     ['#080E14', '#101D28'],
    },
    shadowColor: '#06B6D4',
  },

  // ── ESMERALDA ─────────────────────────────────────────────────────────────
  {
    id: 'esmeralda',
    name: 'Esmeralda',
    emoji: '💎',
    colors: {
      bg:              '#0B1210',
      surface:         '#132720',
      surfaceElevated: '#1A3830',
      surfaceGlass:    'rgba(19,39,32,0.85)',
      border:          '#265040',
      borderGlow:      '#10B981',
      primary:         '#065F46',
      primaryLight:    '#10B981',
      accent:          '#F59E0B',
      accentLight:     '#FBBF24',
      textPrimary:     '#ECFDF5',
      textSecondary:   '#6EE7B7',
      textMuted:       '#4A6B5F',
      inputBg:         '#17302A',
    },
    gradients: {
      primary:  ['#065F46', '#10B981'],
      accent:   ['#D97706', '#F59E0B'],
      card:     ['rgba(26,56,48,0.9)', 'rgba(19,39,32,0.95)'],
      balance:  ['#065F46', '#10B981'],
      dark:     ['#0B1210', '#132720'],
    },
    shadowColor: '#10B981',
  },

  // ── DORADO REAL ───────────────────────────────────────────────────────────
  {
    id: 'dorado',
    name: 'Dorado Real',
    emoji: '👑',
    colors: {
      bg:              '#110E08',
      surface:         '#1F1A10',
      surfaceElevated: '#2D2618',
      surfaceGlass:    'rgba(31,26,16,0.85)',
      border:          '#3D3520',
      borderGlow:      '#D4A017',
      primary:         '#92710C',
      primaryLight:    '#D4A017',
      accent:          '#DC2626',
      accentLight:     '#EF4444',
      textPrimary:     '#FFF8E7',
      textSecondary:   '#C9A96E',
      textMuted:       '#6B5D40',
      inputBg:         '#251F12',
    },
    gradients: {
      primary:  ['#92710C', '#D4A017'],
      accent:   ['#B91C1C', '#DC2626'],
      card:     ['rgba(45,38,24,0.9)', 'rgba(31,26,16,0.95)'],
      balance:  ['#92710C', '#D4A017'],
      dark:     ['#110E08', '#1F1A10'],
    },
    shadowColor: '#D4A017',
  },

  // ── NOCHE VIOLETA ─────────────────────────────────────────────────────────
  {
    id: 'violeta',
    name: 'Noche Violeta',
    emoji: '🔮',
    colors: {
      bg:              '#0D0A14',
      surface:         '#1A1428',
      surfaceElevated: '#261E3A',
      surfaceGlass:    'rgba(26,20,40,0.85)',
      border:          '#3B2D5C',
      borderGlow:      '#8B5CF6',
      primary:         '#6D28D9',
      primaryLight:    '#8B5CF6',
      accent:          '#EC4899',
      accentLight:     '#F472B6',
      textPrimary:     '#F3F0FF',
      textSecondary:   '#A78BFA',
      textMuted:       '#5A4B70',
      inputBg:         '#1E1530',
    },
    gradients: {
      primary:  ['#6D28D9', '#8B5CF6'],
      accent:   ['#DB2777', '#EC4899'],
      card:     ['rgba(38,30,58,0.9)', 'rgba(26,20,40,0.95)'],
      balance:  ['#6D28D9', '#8B5CF6'],
      dark:     ['#0D0A14', '#1A1428'],
    },
    shadowColor: '#8B5CF6',
  },

  // ── FUEGO ─────────────────────────────────────────────────────────────────
  {
    id: 'fuego',
    name: 'Fuego',
    emoji: '🔥',
    colors: {
      bg:              '#130A08',
      surface:         '#1F1410',
      surfaceElevated: '#2D1E18',
      surfaceGlass:    'rgba(31,20,16,0.85)',
      border:          '#4A2A1C',
      borderGlow:      '#F97316',
      primary:         '#C2410C',
      primaryLight:    '#F97316',
      accent:          '#EAB308',
      accentLight:     '#FACC15',
      textPrimary:     '#FFF7ED',
      textSecondary:   '#FB923C',
      textMuted:       '#6B4530',
      inputBg:         '#261812',
    },
    gradients: {
      primary:  ['#C2410C', '#F97316'],
      accent:   ['#CA8A04', '#EAB308'],
      card:     ['rgba(45,30,24,0.9)', 'rgba(31,20,16,0.95)'],
      balance:  ['#C2410C', '#F97316'],
      dark:     ['#130A08', '#1F1410'],
    },
    shadowColor: '#F97316',
  },
];

// ⚠️ Default fallback is 'claro' (Día Claro) to match the app's default theme.
export function getPaletteById(id: string): ColorPalette {
  return (
    PALETTES.find(p => p.id === id) ??
    PALETTES.find(p => p.id === 'claro') ??
    PALETTES[0]
  );
}
