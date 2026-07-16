import React, { useEffect } from 'react';
import { Slot, useRouter, useSegments } from 'expo-router';
import NetInfo from '@react-native-community/netinfo';
import { AuthProvider, useAuth } from '../lib/auth';
import { flushQueue } from '../lib/offlineQueue';

function RootNavigation() {
  const { session, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    const inAuthGroup = segments[0] === '(auth)';

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
    <AuthProvider>
      <RootNavigation />
    </AuthProvider>
  );
}
