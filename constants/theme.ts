// Poppins font family names (loaded via @expo-google-fonts/poppins in _layout.tsx)
export const fonts = {
  regular:   'Poppins_400Regular',
  medium:    'Poppins_500Medium',
  semibold:  'Poppins_600SemiBold',
  bold:      'Poppins_700Bold',
  extrabold: 'Poppins_800ExtraBold',
};

export const theme = {
  colors: {
    // Backgrounds — lighter dark navy (matches updated 'mundial' palette)
    bg:              '#0D1B2E',
    surface:         '#162540',
    surfaceElevated: '#1E3050',
    surfaceGlass:    'rgba(22,37,64,0.88)',
    border:          '#2A4060',
    borderGlow:      '#3B82F6',

    // Brand
    primary:      '#1D4ED8',
    primaryLight: '#3B82F6',
    accent:       '#E11D48',
    accentLight:  '#FB4570',

    // Semantic
    success: '#10B981',
    warning: '#F59E0B',
    error:   '#EF4444',
    gold:    '#FFD700',
    silver:  '#94A3B8',

    // Text
    textPrimary:   '#F1F5FF',
    textSecondary: '#94A3B8',
    textMuted:     '#546882',

    // Compat aliases
    background: '#0D1B2E',
    card:       '#162540',
    text:       '#F1F5FF',
    inputBg:    '#1A2E4A',
  },

  gradients: {
    primary:  ['#1D4ED8', '#3B82F6'] as [string, string],
    accent:   ['#BE123C', '#E11D48'] as [string, string],
    card:     ['rgba(30,48,80,0.92)', 'rgba(22,37,64,0.96)'] as [string, string],
    balance:  ['#1D4ED8', '#3B82F6'] as [string, string],
    dark:     ['#0D1B2E', '#162540'] as [string, string],
    hero:     ['#1D4ED8', '#0D1B2E', '#0A1628'] as unknown as [string, string],
    success:  ['#064E3B', '#059669'] as [string, string],
    gold:     ['#78350F', '#D97706'] as [string, string],
    violet:   ['#4C1D95', '#7C3AED'] as [string, string],
  },

  typography: {
    display:   { fontSize: 32, fontWeight: '800' as '800', letterSpacing: -0.6,  fontFamily: fonts.extrabold },
    h1:        { fontSize: 26, fontWeight: '700' as '700', letterSpacing: -0.4,  fontFamily: fonts.bold },
    h2:        { fontSize: 22, fontWeight: '700' as '700', letterSpacing: -0.2,  fontFamily: fonts.bold },
    h3:        { fontSize: 18, fontWeight: '600' as '600',                        fontFamily: fonts.semibold },
    body:      { fontSize: 15, fontWeight: '400' as '400', lineHeight: 22,        fontFamily: fonts.regular },
    bodySmall: { fontSize: 13, fontWeight: '400' as '400', lineHeight: 19,        fontFamily: fonts.regular },
    caption:   { fontSize: 11, fontWeight: '500' as '500', letterSpacing: 0.4,   fontFamily: fonts.medium },
    label:     { fontSize: 11, fontWeight: '600' as '600', letterSpacing: 0.8,
                 textTransform: 'uppercase' as 'uppercase',                        fontFamily: fonts.semibold },
  },

  spacing: {
    xs:  4,
    sm:  8,
    md:  16,
    lg:  24,
    xl:  32,
    xxl: 48,
  },

  radius: {
    sm:  8,
    md:  12,
    lg:  16,
    xl:  20,
    xxl: 28,
    full: 9999,
  },

  fontSize: {
    xs:   11,
    sm:   13,
    md:   15,
    lg:   17,
    xl:   20,
    xxl:  24,
    xxxl: 32,
  },

  fontWeight: {
    regular:   '400' as '400',
    medium:    '500' as '500',
    semibold:  '600' as '600',
    bold:      '700' as '700',
    extrabold: '800' as '800',
  },

  shadows: {
    sm: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.18,
      shadowRadius: 6,
      elevation: 3,
    },
    md: {
      shadowColor: '#001A6E',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.28,
      shadowRadius: 14,
      elevation: 8,
    },
    lg: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.45,
      shadowRadius: 22,
      elevation: 16,
    },
    glow: {
      shadowColor: '#1A6BFF',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.55,
      shadowRadius: 16,
      elevation: 12,
    },
  },
};

export type Theme = typeof theme;
