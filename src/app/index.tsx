import React from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Redirect } from 'expo-router';
import { useAuth } from '../lib/auth';
import { useThemeColors } from '../lib/theme';

export default function Index() {
  const { session, loading, onboardingComplete } = useAuth();
  const colors = useThemeColors();

  // A signed-in user whose onboarding status hasn't come back yet must wait
  // here too, not just a session-less one -- otherwise someone who signed
  // up, got sent to onboarding, and killed the app before finishing it
  // would land straight in the feed (with a session, but their onboarding
  // never marked complete) on every relaunch after, no way back.
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
