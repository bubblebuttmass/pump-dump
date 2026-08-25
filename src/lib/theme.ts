import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Shared design tokens. Screens should pull colors/spacing/type/radius from
// here instead of hardcoding hex values, so the app reads as one consistent
// product instead of a pile of independently-styled screens.
//
// `colors` used to be a single static palette. It's now resolved at render
// time from ThemeContext (see useThemeColors/useTheme below) so the
// light/dark toggle in Settings can actually repaint the app -- screens pull
// the live palette via the hook instead of importing a fixed object.

const darkColors = {
  bg: '#0b0b0d',
  surface: '#16161a',
  surfaceRaised: '#1e1e24',
  border: '#2a2a31',

  text: '#f5f5f7',
  textMuted: '#9a9aa5',
  // Was #6b6b76 -- 3.74:1 against bg, fails WCAG AA (4.5:1) for the
  // caption/micro text sizes this is used at everywhere. #7c7c88 clears
  // 4.5:1 while staying visually the "faintest" tier below textMuted.
  textFaint: '#7c7c88',

  // Was purple (#7c5cff / #2c2440). Kept distinct from `danger` on purpose
  // (deeper/more saturated red vs danger's lighter coral) so destructive
  // actions don't visually blend into every primary button now that both
  // are red-family.
  primary: '#e63946',
  primaryMuted: '#3d1a1e',
  accent: '#ff5c8a',
  gold: '#ffc93c',
  success: '#33d17a',
  danger: '#ff5c5c',

  white: '#ffffff',
  black: '#000000',
};

// Light palette. Not a mechanical inversion of dark -- a couple of the dark
// theme's accents (gold especially) are too low-contrast against a white
// surface to reuse as-is, so those are deepened here while `primary` stays
// identical across both themes so the brand red reads the same regardless
// of mode.
const lightColors: typeof darkColors = {
  bg: '#f7f7f8',
  surface: '#ffffff',
  surfaceRaised: '#eeeef0',
  border: '#e2e2e6',

  text: '#16161a',
  textMuted: '#55555f',
  // Mirrors dark's textFaint: calibrated to just clear 4.5:1 against this
  // theme's bg/surface rather than reusing the dark-mode value, which was
  // tuned for the opposite direction (light text on dark bg).
  textFaint: '#75757f',

  primary: '#e63946',
  primaryMuted: '#fbdadd',
  accent: '#e0447c',
  // #ffc93c (dark theme's gold) is close to invisible on white. Deepened to
  // an amber that still reads as "gold" but clears contrast for text/icons.
  gold: '#a66a00',
  success: '#1f9d57',
  danger: '#d92c2c',

  white: '#ffffff',
  black: '#000000',
};

export type ThemeColors = typeof darkColors;
export type ThemeMode = 'light' | 'dark' | 'system';
export type ResolvedScheme = 'light' | 'dark';

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 18,
  pill: 999,
};

export const type = {
  display: { fontSize: 28, fontWeight: '800' as const },
  title: { fontSize: 20, fontWeight: '700' as const },
  subtitle: { fontSize: 16, fontWeight: '600' as const },
  body: { fontSize: 15, fontWeight: '400' as const },
  caption: { fontSize: 13, fontWeight: '500' as const },
  micro: { fontSize: 11, fontWeight: '600' as const },
};

export const shadow = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
  },
  raised: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 2,
  },
};

interface ThemeContextValue {
  colors: ThemeColors;
  scheme: ResolvedScheme;
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  colors: darkColors,
  scheme: 'dark',
  mode: 'system',
  setMode: () => {},
});

const STORAGE_KEY = 'pump-dump:theme-mode';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>('system');
  // Distinct from `mode` itself so the very first render (before AsyncStorage
  // resolves) can render the app's original dark look instead of briefly
  // flashing whatever `system` happens to resolve to on this device.
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(STORAGE_KEY).then((saved) => {
      if (cancelled) return;
      if (saved === 'light' || saved === 'dark' || saved === 'system') setModeState(saved);
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  function setMode(next: ThemeMode) {
    setModeState(next);
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
  }

  const scheme: ResolvedScheme = !loaded ? 'dark' : mode === 'system' ? (systemScheme ?? 'dark') : mode;
  const colors = scheme === 'light' ? lightColors : darkColors;

  const value = useMemo(() => ({ colors, scheme, mode, setMode }), [colors, scheme, mode]);

  return React.createElement(ThemeContext.Provider, { value }, children);
}

export function useTheme() {
  return useContext(ThemeContext);
}

// Most screens only need the resolved palette, not the mode-switching
// machinery -- this is the one import they should reach for.
export function useThemeColors(): ThemeColors {
  return useContext(ThemeContext).colors;
}
