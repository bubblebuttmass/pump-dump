# Dark / Light Mode Toggle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a System / Light / Dark appearance toggle in Settings, backed by a new `ThemeContext`, replacing the app's current hardcoded-dark-only styling across every screen.

**Architecture:** `lib/theme.ts` splits its single `colors` export into `darkColors`/`lightColors` (identical keys). A new `lib/ThemeContext.tsx` resolves the active scheme (persisted preference, defaulting to the OS setting) and exposes it via `useTheme()`. Every file that currently imports the static `colors` constant switches to reading it from that hook instead — mechanically identical across ~28 files (see "The mechanical transform" below), verified per-task by `tsc --noEmit`.

**Tech Stack:** React Native's built-in `Appearance`/`useColorScheme`, `@react-native-async-storage/async-storage` (already a dependency), no new packages.

**Spec:** `docs/superpowers/specs/2026-08-23-dark-light-mode-design.md`

## Global Constraints

- Palette values are copied verbatim from the spec's table — do not invent new hex values.
- `spacing`, `radius`, `type`, `shadow` stay theme-independent, shared, unduplicated (unchanged from today).
- Native splash screen stays dark-only (explicit scope cut in the spec — do not add a light splash asset).
- AsyncStorage key name: `theme-preference`. Values: `'system' | 'light' | 'dark'`. Default: `'system'`.

## The Mechanical Transform

Every screen/component file today does, at module scope:

```ts
import { colors, radius, spacing, type as typeScale } from '<relative path>/lib/theme';
// ...component...
const styles = StyleSheet.create({ /* ... uses colors.x throughout ... */ });
```

The fix, applied identically everywhere `colors` is used (Task 4 onward), is exactly these four changes and nothing else:

1. Remove `colors` from the `lib/theme` import (keep `radius`/`spacing`/`type as typeScale` as they are — those don't change).
2. Add `import { useTheme } from '<relative path>/lib/ThemeContext';`.
3. Inside the component function, as its first line: `const { colors } = useTheme();`.
4. Move the `const styles = StyleSheet.create({ ... })` block (contents byte-for-byte unchanged) from module scope to inside the component, wrapped as:
   ```ts
   const styles = useMemo(() => StyleSheet.create({ /* ...unchanged... */ }), [colors]);
   ```
   (add `useMemo` to the file's existing `react` import if not already imported).

Because `colors` becomes a variable local to the component (not a module import), every other in-file reference to `colors.x` — including inline JSX props like `<Ionicons color={colors.primary} />` or `Switch`'s `trackColor={{ true: colors.primary }}` — resolves correctly through normal JS closure rules with **no per-usage edits needed**. This was verified against three different file shapes during planning (a plain screen, a component with inline JSX color props, and a `Tabs`/`Stack` layout file using `screenOptions` instead of `StyleSheet.create` — see Task 2 and the batch tasks for the layout-file variant, which skips the `useMemo`/`StyleSheet` step since there's no style object, just an inline options object that already re-evaluates every render).

After each file, `npx tsc --noEmit` must pass — a leftover static `colors` reference (e.g. a missed usage, or the import line not fully cleaned up) shows up immediately as a type error, since `colors` would no longer be in scope. This is the test for every batch task below; there's no meaningful unit test for a UI recolor (consistent with how the crop-photo and comment-reply features' UI-only pieces were verified in this session).

---

### Task 1: Palette split + ThemeContext

**Files:**
- Modify: `src/lib/theme.ts`
- Create: `src/lib/ThemeContext.tsx`
- Test: `src/__tests__/theme.test.ts`

**Interfaces:**
- Produces: `darkColors`, `lightColors`, `ThemeColors` (type) from `lib/theme.ts`. `ThemeProvider`, `useTheme()` (returns `{ colors, scheme, preference, setPreference }`), `ThemePreference` (type `'system' | 'light' | 'dark'`), `ResolvedScheme` (type `'light' | 'dark'`), `resolveScheme(preference, systemScheme)` (pure function) from `lib/ThemeContext.tsx`.

- [ ] **Step 1: Write the failing test for `resolveScheme`**

Create `src/__tests__/theme.test.ts`:

```ts
import { resolveScheme } from '../lib/ThemeContext';

describe('resolveScheme', () => {
  it('returns dark when preference is dark, regardless of system scheme', () => {
    expect(resolveScheme('dark', 'light')).toBe('dark');
  });

  it('returns light when preference is light, regardless of system scheme', () => {
    expect(resolveScheme('light', 'dark')).toBe('light');
  });

  it('follows the system scheme when preference is system', () => {
    expect(resolveScheme('system', 'light')).toBe('light');
    expect(resolveScheme('system', 'dark')).toBe('dark');
  });

  it('falls back to dark when preference is system and the system scheme is unknown', () => {
    expect(resolveScheme('system', null)).toBe('dark');
    expect(resolveScheme('system', undefined)).toBe('dark');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest theme.test.ts`
Expected: FAIL — `Cannot find module '../lib/ThemeContext'` (file doesn't exist yet).

- [ ] **Step 3: Update `src/lib/theme.ts`**

Replace the existing `export const colors = { ... };` block with:

```ts
export const darkColors = {
  bg: '#0b0b0d',
  surface: '#16161a',
  surfaceRaised: '#1e1e24',
  border: '#2a2a31',

  text: '#f5f5f7',
  textMuted: '#9a9aa5',
  textFaint: '#7c7c88',

  primary: '#e63946',
  primaryMuted: '#3d1a1e',
  accent: '#ff5c8a',
  gold: '#ffc93c',
  success: '#33d17a',
  danger: '#ff5c5c',

  white: '#ffffff',
  black: '#000000',
};

export const lightColors: typeof darkColors = {
  bg: '#f5f4f2',
  surface: '#ffffff',
  surfaceRaised: '#ebe9e6',
  border: '#ddd9d4',

  text: '#1a1a1c',
  textMuted: '#5c5a62',
  textFaint: '#6e6c74',

  primary: '#d1273a',
  primaryMuted: '#fbe3e5',
  accent: '#d6316b',
  gold: '#966200',
  success: '#1f9d5c',
  danger: '#d43d3d',

  white: '#ffffff',
  black: '#000000',
};

export type ThemeColors = typeof darkColors;
```

Leave `spacing`, `radius`, `type`, `shadow` in this file exactly as they are today — do not touch them.

- [ ] **Step 4: Create `src/lib/ThemeContext.tsx`**

```tsx
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Appearance, useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { darkColors, lightColors, ThemeColors } from './theme';

export type ThemePreference = 'system' | 'light' | 'dark';
export type ResolvedScheme = 'light' | 'dark';

const STORAGE_KEY = 'theme-preference';

// Pure on purpose -- see theme.test.ts. No dependency on React, AsyncStorage,
// or RN's Appearance API, so it's directly unit-testable.
export function resolveScheme(preference: ThemePreference, systemScheme: ResolvedScheme | null | undefined): ResolvedScheme {
  if (preference === 'system') return systemScheme ?? 'dark';
  return preference;
}

interface ThemeContextValue {
  colors: ThemeColors;
  scheme: ResolvedScheme;
  preference: ThemePreference;
  setPreference: (pref: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  colors: darkColors,
  scheme: 'dark',
  preference: 'system',
  setPreference: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme() as ResolvedScheme | null;
  const [preference, setPreferenceState] = useState<ThemePreference>('system');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      if (stored === 'light' || stored === 'dark' || stored === 'system') setPreferenceState(stored);
      setLoaded(true);
    });
  }, []);

  const setPreference = useCallback((pref: ThemePreference) => {
    setPreferenceState(pref);
    AsyncStorage.setItem(STORAGE_KEY, pref);
    // Keeps native-controlled UI (system alerts, keyboard appearance) in
    // sync with an explicit choice, not just JS-rendered screens.
    Appearance.setColorScheme(pref === 'system' ? null : pref);
  }, []);

  // Sync native chrome once the persisted preference has loaded, in case it
  // resolved to something other than the OS default at first paint.
  useEffect(() => {
    if (!loaded) return;
    Appearance.setColorScheme(preference === 'system' ? null : preference);
  }, [preference, loaded]);

  const scheme = resolveScheme(preference, systemScheme);
  const colors = scheme === 'dark' ? darkColors : lightColors;

  const value = useMemo(
    () => ({ colors, scheme, preference, setPreference }),
    [colors, scheme, preference, setPreference]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx jest theme.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 6: Type-check**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: exit 0. (`lib/theme.ts` no longer exports `colors` — this is expected to *not* yet break anything, since no other file has been converted to `useTheme()` yet; every other file still does `import { colors, ... } from './theme'`, which is why this task alone will actually fail `tsc` until Task 2 onward converts every consumer. Confirm the failures are only `Module '"./theme"' has no exported member 'colors'` in the files listed in later tasks — no other error kind.)

- [ ] **Step 7: Commit**

```bash
git add src/lib/theme.ts src/lib/ThemeContext.tsx src/__tests__/theme.test.ts
git commit -m "feat: add ThemeContext with dark/light palettes (theme.ts split)"
```

---

### Task 2: Mount ThemeProvider, dynamic status bar, native shell

**Files:**
- Modify: `src/app/_layout.tsx`
- Modify: `app.json`

**Interfaces:**
- Consumes: `ThemeProvider`, `useTheme()` from Task 1 (`src/lib/ThemeContext.tsx`).

- [ ] **Step 1: Update `src/app/_layout.tsx`**

Current relevant content (from the top of the file):

```tsx
import React, { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import NetInfo from '@react-native-community/netinfo';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from '../lib/auth';
import { flushQueue } from '../lib/offlineQueue';
import { colors } from '../lib/theme';
import { Sentry } from '../lib/sentry';

function RootNavigation() {
  const { session, loading } = useAuth();
  ...
  return (
    <>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
        ...
      </Stack>
    </>
  );
}

function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <RootNavigation />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
```

Change it to:

```tsx
import React, { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import NetInfo from '@react-native-community/netinfo';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from '../lib/auth';
import { flushQueue } from '../lib/offlineQueue';
import { ThemeProvider, useTheme } from '../lib/ThemeContext';
import { Sentry } from '../lib/sentry';

function RootNavigation() {
  const { session, loading } = useAuth();
  const { colors, scheme } = useTheme();
  ...
  return (
    <>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
        ...
      </Stack>
    </>
  );
}

function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <RootNavigation />
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
```

(Only the import block, the `useTheme()` line inside `RootNavigation`, the `StatusBar style` prop, and `RootLayout`'s JSX nesting change — everything else in the file, including the whole `useEffect` navigation-guard block and the `<Stack.Screen ... />` list, is untouched.)

- [ ] **Step 2: Update `app.json`**

Change:
```json
"userInterfaceStyle": "dark",
```
to:
```json
"userInterfaceStyle": "automatic",
```
(top-level `expo.userInterfaceStyle` key — leave `ios.icon`, `android.adaptiveIcon`, and everything else in the file untouched. Per the spec's explicit scope cut, do **not** add a `dark`/light splash variant to the `expo-splash-screen` plugin config.)

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: same set of `"./theme" has no exported member 'colors'"` errors as Task 1 left, minus `src/app/_layout.tsx` (now fixed). No new error kinds.

- [ ] **Step 4: Commit**

```bash
git add src/app/_layout.tsx app.json
git commit -m "feat: mount ThemeProvider, dynamic status bar, automatic native appearance"
```

---

### Task 3: Settings screen migration + Appearance toggle

**Files:**
- Modify: `src/app/settings.tsx`

**Interfaces:**
- Consumes: `useTheme()` from Task 1.

- [ ] **Step 1: Apply the mechanical transform (see "The Mechanical Transform" above) to `src/app/settings.tsx`**

- Remove `colors` from `import { colors, radius, spacing, type as typeScale } from '../lib/theme';` (keep the rest).
- Add `import { useTheme } from '../lib/ThemeContext';`.
- Add `import { useMemo } from 'react';` to the existing `React` import (it currently imports `{ useCallback, useState }` from `'react'` — add `useMemo` to that same line).
- Inside `export default function Settings() {`, as the first line: `const { colors, preference, setPreference } = useTheme();`.
- Move the existing `const styles = StyleSheet.create({ ... })` block (all ~35 lines, unchanged content) from module scope to inside the component, wrapped in `useMemo(() => StyleSheet.create({ ... }), [colors])`, placed just before the `return (`.

- [ ] **Step 2: Add the Appearance section**

Add this new section between the existing "Privacy & Safety" section and the "About" section (i.e. right after the `Blocked Accounts` row's closing `</View>` and before `<Text style={styles.sectionTitle}>About</Text>`):

```tsx
      <Text style={styles.sectionTitle}>Appearance</Text>
      <View style={styles.card}>
        <View style={styles.appearanceRow}>
          {(['system', 'light', 'dark'] as const).map((option) => (
            <Pressable
              key={option}
              style={[styles.appearanceChip, preference === option && styles.appearanceChipSelected]}
              onPress={() => setPreference(option)}
              accessibilityRole="button"
              accessibilityState={{ selected: preference === option }}
              accessibilityLabel={`${option === 'system' ? 'System' : option === 'light' ? 'Light' : 'Dark'} appearance`}
            >
              <Text style={[styles.appearanceChipText, preference === option && styles.appearanceChipTextSelected]}>
                {option === 'system' ? 'System' : option === 'light' ? 'Light' : 'Dark'}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
```

- [ ] **Step 3: Add matching styles**

Inside the `useMemo(() => StyleSheet.create({ ... }), [colors])` block from Step 1, add these new keys (alongside the existing ones, e.g. right after `separator`):

```ts
  appearanceRow: { flexDirection: 'row', padding: spacing.xs, gap: spacing.xs },
  appearanceChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
  },
  appearanceChipSelected: { backgroundColor: colors.primary },
  appearanceChipText: { ...typeScale.caption, color: colors.textMuted, fontWeight: '600' },
  appearanceChipTextSelected: { color: colors.white },
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: `src/app/settings.tsx` no longer appears in the error list.

- [ ] **Step 5: Commit**

```bash
git add src/app/settings.tsx
git commit -m "feat: Appearance toggle (System/Light/Dark) in Settings"
```

---

### Task 4: Auth screens batch

**Files:**
- Modify: `src/app/(auth)/login.tsx`
- Modify: `src/app/(auth)/signup.tsx`
- Modify: `src/app/(auth)/onboarding.tsx`
- Modify: `src/app/(auth)/forgot-password.tsx`
- Modify: `src/app/reset-password.tsx`

**Interfaces:**
- Consumes: `useTheme()` from Task 1.

- [ ] **Step 1: Apply the mechanical transform (see "The Mechanical Transform" above) to each of the 5 files listed**

Each file follows the identical pattern: remove `colors` from its `lib/theme` import, add `useTheme` import (mind the relative path depth — `../../lib/ThemeContext` for files directly under `(auth)/`, `../lib/ThemeContext` for `reset-password.tsx`), add `const { colors } = useTheme();` as the component's first line, add `useMemo` to the file's React import if missing, and wrap the file's existing `StyleSheet.create({...})` in `useMemo(() => StyleSheet.create({...}), [colors])` moved inside the component. `onboarding.tsx` additionally uses `colors.danger`/`colors.success` inline (the username-availability hint text) — these need no special handling, they resolve automatically once `colors` is the component-local variable from the hook.

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: none of these 5 files appear in the error list anymore.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(auth)/login.tsx" "src/app/(auth)/signup.tsx" "src/app/(auth)/onboarding.tsx" "src/app/(auth)/forgot-password.tsx" src/app/reset-password.tsx
git commit -m "feat: theme-aware auth screens"
```

---

### Task 5: Tab screens batch

**Files:**
- Modify: `src/app/(tabs)/feed/index.tsx`
- Modify: `src/app/(tabs)/log/index.tsx`
- Modify: `src/app/(tabs)/search/index.tsx`
- Modify: `src/app/(tabs)/profile/index.tsx`
- Modify: `src/app/(tabs)/profile/edit.tsx`

**Interfaces:**
- Consumes: `useTheme()` from Task 1.

- [ ] **Step 1: Apply the mechanical transform to each of the 5 files listed** (same pattern as Task 4 — relative import path is `../../../lib/ThemeContext` for all five, since they're all three levels under `src/app/`)

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: none of these 5 files appear in the error list anymore.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(tabs)/feed/index.tsx" "src/app/(tabs)/log/index.tsx" "src/app/(tabs)/search/index.tsx" "src/app/(tabs)/profile/index.tsx" "src/app/(tabs)/profile/edit.tsx"
git commit -m "feat: theme-aware tab screens"
```

---

### Task 6: Standalone screens batch

**Files:**
- Modify: `src/app/notifications.tsx`
- Modify: `src/app/saved.tsx`
- Modify: `src/app/follow-requests.tsx`
- Modify: `src/app/blocked-accounts.tsx`
- Modify: `src/app/index.tsx`

**Interfaces:**
- Consumes: `useTheme()` from Task 1.

- [ ] **Step 1: Apply the mechanical transform to `notifications.tsx`, `saved.tsx`, `follow-requests.tsx`, `blocked-accounts.tsx`** (import path `../lib/ThemeContext`, one level under `src/app/`)

- [ ] **Step 2: Update `src/app/index.tsx` separately — it's a special case, not a `StyleSheet.create` file**

Current content:
```tsx
import React from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Redirect } from 'expo-router';
import { useAuth } from '../lib/auth';
import { colors } from '../lib/theme';

export default function Index() {
  const { session, loading, onboardingComplete } = useAuth();

  if (loading || (session && onboardingComplete === null)) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!session) return <Redirect href="/(auth)/login" />;
  return <Redirect href={onboardingComplete ? '/(tabs)/feed' : '/(auth)/onboarding'} />;
}
```

Change to:
```tsx
import React from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Redirect } from 'expo-router';
import { useAuth } from '../lib/auth';
import { useTheme } from '../lib/ThemeContext';

export default function Index() {
  const { session, loading, onboardingComplete } = useAuth();
  const { colors } = useTheme();

  if (loading || (session && onboardingComplete === null)) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!session) return <Redirect href="/(auth)/login" />;
  return <Redirect href={onboardingComplete ? '/(tabs)/feed' : '/(auth)/onboarding'} />;
}
```
(No `StyleSheet`/`useMemo` needed here — the inline style object already re-evaluates on every render.)

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: none of these 5 files appear in the error list anymore.

- [ ] **Step 4: Commit**

```bash
git add src/app/notifications.tsx src/app/saved.tsx src/app/follow-requests.tsx src/app/blocked-accounts.tsx src/app/index.tsx
git commit -m "feat: theme-aware standalone screens"
```

---

### Task 7: User/workout detail screens batch

**Files:**
- Modify: `src/app/user/[id]/index.tsx`
- Modify: `src/app/user/[id]/followers.tsx`
- Modify: `src/app/user/[id]/following.tsx`
- Modify: `src/app/workout/[id].tsx`

**Interfaces:**
- Consumes: `useTheme()` from Task 1.

- [ ] **Step 1: Apply the mechanical transform to each of the 4 files listed** (`../../../lib/ThemeContext` for the three `user/[id]/` files, `../../lib/ThemeContext` for `workout/[id].tsx`). `workout/[id].tsx` already imports `useCallback, useRef, useState` from `react` — add `useMemo` to that same import line.

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: none of these 4 files appear in the error list anymore.

- [ ] **Step 3: Commit**

```bash
git add "src/app/user/[id]/index.tsx" "src/app/user/[id]/followers.tsx" "src/app/user/[id]/following.tsx" "src/app/workout/[id].tsx"
git commit -m "feat: theme-aware user profile and workout detail screens"
```

---

### Task 8: Shared components batch

**Files:**
- Modify: `src/components/FeedCard.tsx`
- Modify: `src/components/Skeleton.tsx`
- Modify: `src/components/PhotoCarousel.tsx`
- Modify: `src/components/AnimatedTabIcon.tsx`
- Modify: `src/components/CelebrationModal.tsx`

**Interfaces:**
- Consumes: `useTheme()` from Task 1.

- [ ] **Step 1: Apply the mechanical transform to each of the 5 files listed** (import path `../lib/ThemeContext`, one level under `src/components/`). `AnimatedTabIcon.tsx` and `CelebrationModal.tsx` both reference `colors.x` inline in JSX (`<Ionicons color={colors.gold} />` etc.) in addition to their `StyleSheet.create` blocks — no special handling needed, same closure rule as noted in "The Mechanical Transform".

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: exit 0, zero errors — this is the last batch, every file that imports `lib/theme`'s `colors` has now been converted.

- [ ] **Step 3: Run the full test suite**

Run: `npx jest`
Expected: all suites pass (should be unaffected by this batch, but confirms nothing broke).

- [ ] **Step 4: Commit**

```bash
git add src/components/FeedCard.tsx src/components/Skeleton.tsx src/components/PhotoCarousel.tsx src/components/AnimatedTabIcon.tsx src/components/CelebrationModal.tsx
git commit -m "feat: theme-aware shared components"
```

---

### Task 9: Layout files batch (screenOptions, not StyleSheet)

**Files:**
- Modify: `src/app/(tabs)/_layout.tsx`
- Modify: `src/app/(tabs)/profile/_layout.tsx`

**Interfaces:**
- Consumes: `useTheme()` from Task 1.

These two files configure React Navigation's `Tabs`/`Stack` via an inline `screenOptions` object, not a `StyleSheet.create` block — there's no `useMemo`/`StyleSheet` step; the options object already re-evaluates every render, and a theme change re-renders the component (since `useTheme()` subscribes to context).

- [ ] **Step 1: Update `src/app/(tabs)/_layout.tsx`**

Current:
```tsx
import { Tabs } from 'expo-router';
import { colors } from '../../lib/theme';
import { AnimatedTabIcon } from '../../components/AnimatedTabIcon';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textFaint,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
      }}
    >
      ...
    </Tabs>
  );
}
```

Change to:
```tsx
import { Tabs } from 'expo-router';
import { useTheme } from '../../lib/ThemeContext';
import { AnimatedTabIcon } from '../../components/AnimatedTabIcon';

export default function TabsLayout() {
  const { colors } = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textFaint,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
      }}
    >
      ...
    </Tabs>
  );
}
```
(Only the import line and the added `const { colors } = useTheme();` change — the entire `<Tabs.Screen ... />` list is untouched.)

- [ ] **Step 2: Update `src/app/(tabs)/profile/_layout.tsx`**

Current:
```tsx
import { Stack } from 'expo-router';
import { colors } from '../../../lib/theme';

export default function ProfileLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" options={{ title: 'Profile' }} />
      <Stack.Screen
        name="edit"
        options={{
          headerShown: true,
          title: 'Edit Profile',
          headerBackButtonDisplayMode: 'minimal',
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.primary,
          headerTitleStyle: { color: colors.text },
        }}
      />
    </Stack>
  );
}
```

Change to:
```tsx
import { Stack } from 'expo-router';
import { useTheme } from '../../../lib/ThemeContext';

export default function ProfileLayout() {
  const { colors } = useTheme();
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" options={{ title: 'Profile' }} />
      <Stack.Screen
        name="edit"
        options={{
          headerShown: true,
          title: 'Edit Profile',
          headerBackButtonDisplayMode: 'minimal',
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.primary,
          headerTitleStyle: { color: colors.text },
        }}
      />
    </Stack>
  );
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: exit 0.

- [ ] **Step 4: Run the full test suite**

Run: `npx jest`
Expected: all suites pass.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(tabs)/_layout.tsx" "src/app/(tabs)/profile/_layout.tsx"
git commit -m "feat: theme-aware tab and profile navigator chrome"
```

---

## Manual verification (after all tasks)

Not automatable — do this on a real build, per the spec's testing section:

1. Settings → Appearance: tap System, Light, Dark. Confirm the whole app (not just Settings) recolors immediately with no restart.
2. Force-quit and reopen the app after picking Light (or Dark) explicitly. Confirm it opens in that theme, not System, i.e. persistence survived a restart.
3. With preference on System, change the phone's OS-level appearance (Settings app) while Pump Dump is open. Confirm the app follows along live.
4. Spot-check Feed, a workout detail page, Search (suggested users), Settings, and Onboarding in both Light and Dark — confirm no leftover hardcoded-dark element (a still-black background behind light text, etc.).
5. Confirm the status bar glyphs (clock/battery) stay legible in both themes (dark glyphs on light bg, light glyphs on dark bg).
