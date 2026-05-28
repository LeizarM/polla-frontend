/** @type {import('tailwindcss').Config} */
module.exports = {
  // ── NativeWind preset (REQUIRED) ───────────────────────────────────────────
  presets: [require('nativewind/preset')],

  // ── Content paths (NativeWind v4 scans everything) ─────────────────────────
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
    './screens/**/*.{js,jsx,ts,tsx}',
    './contexts/**/*.{js,jsx,ts,tsx}',
    './hooks/**/*.{js,jsx,ts,tsx}',
  ],

  // ── Dark mode via class strategy ───────────────────────────────────────────
  darkMode: 'class',

  theme: {
    extend: {
      // ── Colors: all semantic tokens via CSS custom properties ─────────────
      // This enables classes like: bg-surface, text-primary, border-glow, etc.
      // At runtime, ThemeContext sets the CSS vars → all classes update instantly.
      colors: {
        // Backgrounds
        bg:               'var(--color-bg)',
        surface:          'var(--color-surface)',
        'surface-elevated':'var(--color-surface-elevated)',
        'surface-glass':  'var(--color-surface-glass)',

        // Borders
        border:           'var(--color-border)',
        'border-glow':    'var(--color-border-glow)',

        // Brand
        primary:          'var(--color-primary)',
        'primary-light':  'var(--color-primary-light)',
        accent:           'var(--color-accent)',
        'accent-light':   'var(--color-accent-light)',

        // Semantic
        success:          'var(--color-success)',
        warning:          'var(--color-warning)',
        error:            'var(--color-error)',
        gold:             'var(--color-gold)',
        silver:           'var(--color-silver)',

        // Text
        'text-primary':   'var(--color-text-primary)',
        'text-secondary': 'var(--color-text-secondary)',
        'text-muted':     'var(--color-text-muted)',
        'input-bg':       'var(--color-input-bg)',
      },

      // ── Spacing: project scale (xs=4 → xxl=48) ────────────────────────────
      spacing: {
        xs:  '4px',
        sm:  '8px',
        md:  '16px',
        lg:  '24px',
        xl:  '32px',
        xxl: '48px',
      },

      // ── Border Radius: project scale ──────────────────────────────────────
      borderRadius: {
        sm:  '8px',
        md:  '12px',
        lg:  '16px',
        xl:  '20px',
        xxl: '28px',
        full:'9999px',
      },

      // ── Font sizes: project scale ──────────────────────────────────────────
      fontSize: {
        'display': ['32px', { lineHeight: '38px', letterSpacing: '-0.6px', fontWeight: '800' }],
        'h1':      ['26px', { lineHeight: '32px', letterSpacing: '-0.4px', fontWeight: '700' }],
        'h2':      ['22px', { lineHeight: '28px', letterSpacing: '-0.2px', fontWeight: '700' }],
        'h3':      ['18px', { lineHeight: '24px', fontWeight: '600' }],
        'body':    ['15px', { lineHeight: '22px', fontWeight: '400' }],
        'body-sm': ['13px', { lineHeight: '19px', fontWeight: '400' }],
        'caption': ['11px', { lineHeight: '16px', letterSpacing: '0.4px', fontWeight: '500' }],
        'label':   ['11px', { lineHeight: '14px', letterSpacing: '0.8px', fontWeight: '600' }],
        // Keep Tailwind defaults too
        'xs': '12px',
        'sm': '14px',
        'base': '16px',
        'lg': '18px',
        'xl': '20px',
        '2xl': '24px',
        '3xl': '30px',
        '4xl': '36px',
      },

      // ── Font families ──────────────────────────────────────────────────────
      fontFamily: {
        sans:       ['Poppins_400Regular', 'system-ui', 'sans-serif'],
        medium:     ['Poppins_500Medium',  'system-ui', 'sans-serif'],
        semibold:   ['Poppins_600SemiBold','system-ui', 'sans-serif'],
        bold:       ['Poppins_700Bold',    'system-ui', 'sans-serif'],
        extrabold:  ['Poppins_800ExtraBold','system-ui','sans-serif'],
      },

      // ── Box shadows (web) ──────────────────────────────────────────────────
      boxShadow: {
        'sm':   '0 2px 6px 0 rgba(0,0,0,0.18)',
        'md':   '0 6px 14px 0 rgba(0,26,110,0.28)',
        'lg':   '0 10px 22px 0 rgba(0,0,0,0.45)',
        'glow': '0 0 16px 0 var(--color-border-glow)',
        'glow-accent': '0 0 20px 0 var(--color-accent)',
        'card': '0 4px 12px 0 rgba(0,0,0,0.25)',
        'none': 'none',
      },

      // ── Animation keyframes ────────────────────────────────────────────────
      keyframes: {
        'fade-in':    { from: { opacity: '0' },              to: { opacity: '1' } },
        'fade-up':    { from: { opacity: '0', transform: 'translateY(16px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        'fade-down':  { from: { opacity: '0', transform: 'translateY(-16px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        'scale-in':   { from: { opacity: '0', transform: 'scale(0.92)' }, to: { opacity: '1', transform: 'scale(1)' } },
        'slide-left': { from: { transform: 'translateX(-100%)' }, to: { transform: 'translateX(0)' } },
        'shimmer':    { '0%': { backgroundPosition: '-200% 0' }, '100%': { backgroundPosition: '200% 0' } },
        'pulse-glow': {
          '0%, 100%': { boxShadow: '0 0 8px 0 var(--color-border-glow)' },
          '50%':      { boxShadow: '0 0 20px 4px var(--color-border-glow)' },
        },
        'bounce-sm': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%':      { transform: 'translateY(-4px)' },
        },
      },

      animation: {
        'fade-in':    'fade-in 0.3s ease-out',
        'fade-up':    'fade-up 0.4s ease-out',
        'fade-down':  'fade-down 0.4s ease-out',
        'scale-in':   'scale-in 0.25s ease-out',
        'slide-left': 'slide-left 0.3s ease-out',
        'shimmer':    'shimmer 2s infinite linear',
        'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
        'bounce-sm':  'bounce-sm 1s ease-in-out infinite',
      },

      // ── Responsive breakpoints (aligned with useBreakpoint) ───────────────
      screens: {
        sm:  '480px',
        md:  '768px',   // ← Desktop breakpoint (matches DESKTOP_BREAKPOINT: 768)
        lg:  '1024px',
        xl:  '1280px',
        '2xl': '1536px',
      },

      // ── Backdrop blur ──────────────────────────────────────────────────────
      backdropBlur: {
        xs: '4px',
        sm: '8px',
        md: '12px',
        lg: '20px',
      },

      // ── Transition durations ───────────────────────────────────────────────
      transitionDuration: {
        fast:   '150ms',
        normal: '250ms',
        slow:   '400ms',
      },
    },
  },

  plugins: [],
};
