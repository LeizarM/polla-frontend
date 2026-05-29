/**
 * ThemeContext — Dual-mode theme system
 *
 * ┌──────────────────────────────────────────────────────────────┐
 * │  Web:    Updates document.documentElement CSS custom vars    │
 * │  Native: Uses NativeWind vars() to propagate to children     │
 * │  Legacy: Still exports `theme` object for makeStyles() compat│
 * └──────────────────────────────────────────────────────────────┘
 */

import React, {
  createContext, useContext, useState, useEffect, useCallback, useMemo,
} from 'react';
import { Platform, View } from 'react-native';
import { vars } from 'nativewind';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { theme as baseTheme, Theme } from '../constants/theme';
import { ColorPalette, PALETTES, getPaletteById } from '../constants/palettes';
import { useAuthStore } from '../store/authStore';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface ThemeContextType {
  theme: Theme;
  palette: ColorPalette;
  paletteId: string;
  setPaletteId: (id: string) => void;
  palettes: ColorPalette[];
  refreshPalette: () => void;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Build the NativeWind CSS-vars object from a palette.
 * On native, `vars()` polyfills CSS custom properties so children can use
 * classes like `bg-surface`, `text-primary`, etc.
 */
function buildCssVars(palette: ColorPalette) {
  return vars({
    '--color-bg':               palette.colors.bg,
    '--color-surface':          palette.colors.surface,
    '--color-surface-elevated': palette.colors.surfaceElevated,
    '--color-surface-glass':    palette.colors.surfaceGlass,
    '--color-border':           palette.colors.border,
    '--color-border-glow':      palette.colors.borderGlow,
    '--color-primary':          palette.colors.primary,
    '--color-primary-light':    palette.colors.primaryLight,
    '--color-accent':           palette.colors.accent,
    '--color-accent-light':     palette.colors.accentLight,
    '--color-success':          '#10B981',
    '--color-warning':          '#F59E0B',
    '--color-error':            '#EF4444',
    '--color-gold':             '#FFD700',
    '--color-silver':           '#94A3B8',
    '--color-text-primary':     palette.colors.textPrimary,
    '--color-text-secondary':   palette.colors.textSecondary,
    '--color-text-muted':       palette.colors.textMuted,
    '--color-input-bg':         palette.colors.inputBg,
  });
}

/**
 * On web only: update CSS custom properties on :root so NativeWind's
 * Tailwind utility classes reflect the new palette instantly.
 */
function syncWebCssVars(palette: ColorPalette) {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;
  const root = document.documentElement;
  const c = palette.colors;
  root.style.setProperty('--color-bg',               c.bg);
  root.style.setProperty('--color-surface',          c.surface);
  root.style.setProperty('--color-surface-elevated', c.surfaceElevated);
  root.style.setProperty('--color-surface-glass',    c.surfaceGlass);
  root.style.setProperty('--color-border',           c.border);
  root.style.setProperty('--color-border-glow',      c.borderGlow);
  root.style.setProperty('--color-primary',          c.primary);
  root.style.setProperty('--color-primary-light',    c.primaryLight);
  root.style.setProperty('--color-accent',           c.accent);
  root.style.setProperty('--color-accent-light',     c.accentLight);
  root.style.setProperty('--color-text-primary',     c.textPrimary);
  root.style.setProperty('--color-text-secondary',   c.textSecondary);
  root.style.setProperty('--color-text-muted',       c.textMuted);
  root.style.setProperty('--color-input-bg',         c.inputBg);
}

// ─── Context ───────────────────────────────────────────────────────────────────

// ⚠️ Default palette: "Día Claro" (light theme). Cambiable desde Perfil.
const DEFAULT_PALETTE_ID = 'claro';

const ThemeContext = createContext<ThemeContextType>({
  theme: baseTheme,
  palette: getPaletteById(DEFAULT_PALETTE_ID),
  paletteId: DEFAULT_PALETTE_ID,
  setPaletteId: () => {},
  palettes: PALETTES,
  refreshPalette: () => {},
});

const PALETTE_STORAGE_KEY = 'user_palette';

// ─── Provider ──────────────────────────────────────────────────────────────────

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [paletteId, setPaletteIdState] = useState(DEFAULT_PALETTE_ID);
  const user = useAuthStore((s: any) => s.user);

  // Load palette from AsyncStorage on mount / user change
  useEffect(() => {
    const loadPalette = async () => {
      try {
        const key = user?.id ? `${PALETTE_STORAGE_KEY}_${user.id}` : PALETTE_STORAGE_KEY;
        const stored = Platform.OS === 'web'
          ? localStorage?.getItem?.(key)
          : await AsyncStorage.getItem(key);
        if (stored && getPaletteById(stored)?.id === stored) {
          setPaletteIdState(stored);
        }
      } catch {}
    };
    loadPalette();
  }, [user?.id]);

  const setPaletteId = useCallback(async (id: string) => {
    setPaletteIdState(id);
    try {
      const key = user?.id ? `${PALETTE_STORAGE_KEY}_${user.id}` : PALETTE_STORAGE_KEY;
      if (Platform.OS === 'web') {
        localStorage?.setItem?.(key, id);
      } else {
        await AsyncStorage.setItem(key, id);
      }
    } catch {}
  }, [user?.id]);

  const refreshPalette = useCallback(() => {
    const key = user?.id ? `${PALETTE_STORAGE_KEY}_${user.id}` : PALETTE_STORAGE_KEY;
    if (Platform.OS === 'web') {
      const stored = localStorage?.getItem?.(key);
      if (stored && getPaletteById(stored)?.id === stored) setPaletteIdState(stored);
    } else {
      AsyncStorage.getItem(key).then(stored => {
        if (stored && getPaletteById(stored)?.id === stored) setPaletteIdState(stored);
      }).catch(() => {});
    }
  }, [user?.id]);

  const palette = useMemo(() => getPaletteById(paletteId), [paletteId]);

  // Sync web CSS vars whenever palette changes
  useEffect(() => {
    syncWebCssVars(palette);
  }, [palette]);

  // Build NativeWind vars() style object (native CSS-var polyfill)
  const nativeVars = useMemo(() => buildCssVars(palette), [palette]);

  const mergedTheme = useMemo((): Theme => ({
    ...baseTheme,
    colors: {
      ...baseTheme.colors,
      ...palette.colors,
      success:    baseTheme.colors.success,
      warning:    baseTheme.colors.warning,
      error:      baseTheme.colors.error,
      gold:       baseTheme.colors.gold,
      silver:     baseTheme.colors.silver,
      background: palette.colors.bg,
      card:       palette.colors.surface,
      text:       palette.colors.textPrimary,
    },
    gradients: {
      ...baseTheme.gradients,
      ...palette.gradients,
    },
    shadows: {
      ...baseTheme.shadows,
      md: {
        ...baseTheme.shadows.md,
        shadowColor: palette.shadowColor,
      },
      glow: {
        ...baseTheme.shadows.glow,
        shadowColor: palette.shadowColor,
      },
    },
  }), [palette]);

  const value = useMemo(() => ({
    theme: mergedTheme,
    palette,
    paletteId,
    setPaletteId,
    palettes: PALETTES,
    refreshPalette,
  }), [mergedTheme, palette, paletteId, setPaletteId, refreshPalette]);

  return (
    <ThemeContext.Provider value={value}>
      {/*
       * Root View with NativeWind vars() style:
       *   - On native: propagates CSS custom properties to all descendants
       *   - On web:    no-op (document.documentElement handles it above)
       */}
      <View style={[{ flex: 1 }, nativeVars]}>
        {children}
      </View>
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
