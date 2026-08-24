# Dark / Light Mode Toggle — Design

**Status:** Approved, ready for implementation plan
**Date:** 2026-08-23

## Goal

Add a System / Light / Dark appearance toggle to Settings. Currently the app is
hardcoded dark-only: `lib/theme.ts` exports a single static `colors` object,
imported directly into `StyleSheet.create()` calls at module load time across
28 files, and `app.json` forces `"userInterfaceStyle": "dark"`.

## Palette

Dark palette is unchanged. Light palette (approved via visual mockup —
swatches + Settings-row and feed-card mockups in both themes):

| Token | Dark (existing) | Light (new) |
|---|---|---|
| `bg` | `#0b0b0d` | `#f5f4f2` |
| `surface` | `#16161a` | `#ffffff` |
| `surfaceRaised` | `#1e1e24` | `#ebe9e6` |
| `border` | `#2a2a31` | `#ddd9d4` |
| `text` | `#f5f5f7` | `#1a1a1c` |
| `textMuted` | `#9a9aa5` | `#5c5a62` |
| `textFaint` | `#7c7c88` | `#6e6c74` (4.96:1 on `bg`) |
| `primary` | `#e63946` | `#d1273a` (5.17:1 on white) |
| `primaryMuted` | `#3d1a1e` | `#fbe3e5` |
| `accent` | `#ff5c8a` | `#d6316b` |
| `gold` | `#ffc93c` | `#966200` (4.51:1 on white) |
| `success` | `#33d17a` | `#1f9d5c` |
| `danger` | `#ff5c5c` | `#d43d3d` (4.65:1 on white) |
| `white` | `#ffffff` | `#ffffff` (unchanged — used against colored fills, not the page bg) |
| `black` | `#000000` | `#000000` (unchanged) |

Reds/status colors are deepened versions of their dark-mode counterparts (same
hue family, same brand), not flat reuse — the dark-mode values are bright
enough to read on near-black but fail AA contrast (4.5:1) as text/icon color
on a light background. `spacing`, `radius`, `type`, `shadow` are
theme-independent and stay shared, unduplicated.

## Architecture

**`lib/theme.ts`**: keeps `spacing`/`radius`/`type`/`shadow` as-is. `colors` is
replaced by `darkColors` and `lightColors` (identical key sets, table above).

**`lib/ThemeContext.tsx`** (new): `ThemeProvider` + `useTheme()` hook.
- Reads/writes an AsyncStorage key (e.g. `theme-preference`) with value
  `'system' | 'light' | 'dark'`, default `'system'`.
- Resolves the actual scheme: `preference === 'system' ? (useColorScheme() ?? 'dark') : preference`.
- Calls `Appearance.setColorScheme(preference === 'system' ? null : preference)`
  as a side effect on preference change, so native-controlled chrome (system
  alerts, keyboard appearance) matches the explicit choice too, not just
  JS-rendered screens.
- Provides `{ colors, scheme, preference, setPreference }`.
- Mounted in `_layout.tsx`, wrapping `AuthProvider` (available everywhere,
  including screens that render before auth resolves).

**Per-file migration (the mechanical part, ~28 files):** each currently does
`const styles = StyleSheet.create({...})` once at module load, referencing the
static `colors` import directly. This becomes:

```ts
function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({ ... });
}
// inside the component:
const { colors } = useTheme();
const styles = useMemo(() => makeStyles(colors), [colors]);
```

This is the standard RN pattern for dynamic theming (no CSS custom properties
in RN's built-in styling; a styling library like unistyles/NativeWind would
reduce this boilerplate but is a new dependency and bigger shift than this
feature justifies — rejected as YAGNI). Rejected alternative: phased rollout
(theme a few screens now, rest later) — a half-themed app reads as broken,
not polished, for something this visible; doing all files in one pass is the
right call despite the larger diff.

**Not every file follows the identical shape** — most are simple
`StyleSheet.create` screens, but `_layout.tsx` files configure navigator
options (e.g. tab bar tint colors) rather than component styles, and
`app/index.tsx` only uses `colors.bg`/`colors.primary` for a loading spinner.
The implementation plan should audit each file's actual usage rather than
assume a uniform transform applies everywhere.

Known files importing from `lib/theme` (audit for exact usage per file
during implementation):

```
src/app/_layout.tsx
src/app/index.tsx
src/app/(auth)/login.tsx
src/app/(auth)/signup.tsx
src/app/(auth)/onboarding.tsx
src/app/(auth)/forgot-password.tsx
src/app/(tabs)/_layout.tsx
src/app/(tabs)/feed/index.tsx
src/app/(tabs)/log/index.tsx
src/app/(tabs)/search/index.tsx
src/app/(tabs)/profile/_layout.tsx
src/app/(tabs)/profile/index.tsx
src/app/(tabs)/profile/edit.tsx
src/app/user/[id]/index.tsx
src/app/user/[id]/followers.tsx
src/app/user/[id]/following.tsx
src/app/workout/[id].tsx
src/app/settings.tsx
src/app/notifications.tsx
src/app/saved.tsx
src/app/follow-requests.tsx
src/app/blocked-accounts.tsx
src/app/reset-password.tsx
src/components/FeedCard.tsx
src/components/Skeleton.tsx
src/components/PhotoCarousel.tsx
src/components/AnimatedTabIcon.tsx
src/components/CelebrationModal.tsx
```

## Settings UI

New "Appearance" section, placed above "About". A 3-way segmented row
(System / Light / Dark) reusing the existing chip-pill visual pattern already
used for trait selection in Edit Profile (not a `Switch` — binary doesn't fit
3 states). Selecting an option calls `setPreference`, which persists to
AsyncStorage and updates the resolved scheme immediately (no app restart).

## Native shell

- `app.json`: `"userInterfaceStyle"` changes from `"dark"` to `"automatic"`.
- `_layout.tsx`: hardcoded `<StatusBar style="light" />` becomes
  `<StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />` (status bar
  glyph color is the inverse of the theme — light text on dark bg, dark text
  on light bg), and the `Stack`'s `contentStyle` background follows the
  resolved theme instead of the static dark bg.

**Scope cut:** the native splash screen (shown before any JS executes) stays
dark-only. A proper light-mode splash needs a new light-appropriate image
asset that doesn't exist yet; a sub-second flash of a dark splash before a
light-themed app loads is standard, shipped behavior in other apps. Revisit
if it bothers you in practice.

## Testing

Visual/native-behavior work, not meaningfully unit-testable in this repo's
existing Jest setup (same conclusion as the photo-crop feature). Verify via
`tsc --noEmit` for the mechanical refactor's correctness, and manual
testing on a real build (toggle through all three states, confirm
persistence across app restart, spot-check a sample of screens in both
themes) before shipping.

## Out of scope

- Per-screen custom theme overrides.
- Scheduled/time-based auto-switching beyond what OS "System" already provides.
- Light-mode app icon variant (iOS/Android already support this natively via
  OS-level alternate icons, but that's a separate, unrequested feature).
