// Shared design tokens. Screens should pull colors/spacing/type/radius from
// here instead of hardcoding hex values, so the app reads as one consistent
// product instead of a pile of independently-styled screens.

export const colors = {
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
