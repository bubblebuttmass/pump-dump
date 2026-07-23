import React, { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import NetInfo from '@react-native-community/netinfo';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from '../lib/auth';
import { flushQueue } from '../lib/offlineQueue';

function RootNavigation() {
  const { session, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    // The bare root path is handled declaratively by src/app/index.tsx's
    // <Redirect>. Racing an imperative redirect here against that one
    // corrupts the web navigator's stack, so skip it.
    const [first] = segments;
    if (first === undefined) return;
    const inAuthGroup = first === '(auth)';

    if (!session && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (session && inAuthGroup) {
      router.replace('/(tabs)/feed');
    }
  }, [session, loading, segments]);

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
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="workout" />
      <Stack.Screen name="user" />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <RootNavigation />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
