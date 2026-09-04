import React, { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import NetInfo from '@react-native-community/netinfo';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from '../lib/auth';
import { flushQueue } from '../lib/offlineQueue';
import { ThemeProvider, useTheme } from '../lib/theme';
import { Sentry } from '../lib/sentry';

function RootNavigation() {
  const { session, loading, onboardingComplete } = useAuth();
  const { colors, scheme } = useTheme();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    // The bare root path is handled declaratively by src/app/index.tsx's
    // <Redirect>. Racing an imperative redirect here against that one
    // corrupts the web navigator's stack, so skip it.
    const [first, second] = segments as readonly string[];
    if (first === undefined) return;
    const inAuthGroup = first === '(auth)';
    // reset-password briefly has no session (before the recovery link's
    // tokens are consumed) and then a session (once they are) -- gating on
    // either state here would yank the user away mid-flow, so this route is
    // exempt from both branches and manages its own navigation.
    const isPasswordReset = first === 'reset-password';
    const isOnboarding = inAuthGroup && second === 'onboarding';

    if (!session && !inAuthGroup && !isPasswordReset) {
      router.replace('/(auth)/login');
    } else if (session && inAuthGroup && !isOnboarding) {
      // A signed-in user on login/signup (navigated back manually, or a
      // stale screen from before session resolved) belongs at onboarding or
      // the feed depending on which they've actually finished -- not always
      // the feed, or an account with onboarding still incomplete would get
      // bounced straight past it exactly like the bug this whole gate
      // exists to close. Leave onboardingComplete === null (still
      // resolving) alone; this effect re-runs once it settles.
      if (onboardingComplete === false) router.replace('/(auth)/onboarding');
      else if (onboardingComplete === true) router.replace('/(tabs)/feed');
    }
  }, [session, loading, segments, onboardingComplete]);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      if (state.isConnected) flushQueue();
    });
    return () => unsubscribe();
  }, []);

  // A real Stack (not a bare Slot) so pushing into /workout or /user keeps
  // (tabs) mounted underneath instead of tearing it down -- with Slot, only
  // one top-level branch renders at a time, so leaving (tabs) entirely and
  // coming back remounted the Tabs navigator fresh at its initial tab
  // (Feed), losing whichever tab (e.g. Profile) the user actually came from.
  return (
    <>
      <StatusBar style={scheme === 'light' ? 'dark' : 'light'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="workout" />
        <Stack.Screen name="user" />
        <Stack.Screen name="notifications" />
        <Stack.Screen name="saved" />
        <Stack.Screen name="follow-requests" />
        <Stack.Screen name="settings" />
        <Stack.Screen name="blocked-accounts" />
        <Stack.Screen name="reset-password" />
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

// Sentry.wrap adds an error boundary around the whole tree plus native crash
// / navigation instrumentation -- a plain try/catch at this level wouldn't
// catch render-phase errors the way an error boundary does.
export default Sentry.wrap(RootLayout);
