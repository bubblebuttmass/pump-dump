import React, { useEffect } from 'react';
import { Slot, useRouter, useSegments } from 'expo-router';
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

  return <Slot />;
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
