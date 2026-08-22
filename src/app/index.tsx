import React from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Redirect } from 'expo-router';
import { useAuth } from '../lib/auth';
import { colors } from '../lib/theme';

export default function Index() {
  const { session, loading, onboardingComplete } = useAuth();

  // Also wait on onboardingComplete once a session exists -- routing to feed
  // before it resolves would show the feed for a frame even for an account
  // that's about to get redirected back to onboarding.
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
