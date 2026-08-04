import React, { useEffect, useState } from 'react';
import { View, TextInput, Text, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import * as Linking from 'expo-linking';
import { supabase } from '../lib/supabase';
import { showAlert } from '../lib/alert';
import { AnimatedView } from '../components/AnimatedScreen';
import { PressableScale } from '../components/PressableScale';
import { colors, radius, spacing, type as typeScale } from '../lib/theme';

// The recovery email link lands here as lifterapp://reset-password#access_token=...
// &refresh_token=...&type=recovery -- the tokens ride in the hash fragment (same
// implicit-flow shape Google login already parses in (auth)/login.tsx), not a
// route param, so we read the raw URL directly instead of useLocalSearchParams.
function useRecoverySession() {
  const [status, setStatus] = useState<'checking' | 'ready' | 'invalid'>('checking');

  useEffect(() => {
    let cancelled = false;

    async function consume(url: string | null) {
      if (!url || !url.includes('access_token')) {
        if (!cancelled) setStatus('invalid');
        return;
      }
      const hash = url.includes('#') ? url.substring(url.indexOf('#') + 1) : '';
      const params = new URLSearchParams(hash);
      const access_token = params.get('access_token');
      const refresh_token = params.get('refresh_token');
      if (!access_token || !refresh_token) {
        if (!cancelled) setStatus('invalid');
        return;
      }
      const { error } = await supabase.auth.setSession({ access_token, refresh_token });
      if (!cancelled) setStatus(error ? 'invalid' : 'ready');
    }

    Linking.getInitialURL().then(consume);
    const subscription = Linking.addEventListener('url', ({ url }) => consume(url));
    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, []);

  return status;
}

export default function ResetPassword() {
  const status = useRecoverySession();
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (password.length < 6) {
      showAlert('Password too short', 'Use at least 6 characters.');
      return;
    }
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password });
    setSaving(false);
    if (error) {
      showAlert('Could not update password', error.message);
      return;
    }
    showAlert('Password updated', "You're all set.");
    router.replace('/(tabs)/feed');
  }

  if (status !== 'ready') {
    return (
      <AnimatedView style={styles.container}>
        <Text style={styles.title}>Reset password</Text>
        <Text style={styles.body}>
          {status === 'checking'
            ? 'Verifying your reset link...'
            : 'This reset link is invalid or has expired. Request a new one from the login screen.'}
        </Text>
        {status === 'invalid' && (
          <PressableScale style={styles.button} onPress={() => router.replace('/(auth)/login')} scaleTo={0.97}>
            <Text style={styles.buttonText}>Back to log in</Text>
          </PressableScale>
        )}
      </AnimatedView>
    );
  }

  return (
    <AnimatedView style={styles.container}>
      <Text style={styles.title}>Set a new password</Text>
      <TextInput
        style={styles.input}
        placeholder="New password"
        placeholderTextColor={colors.textFaint}
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      <PressableScale style={styles.button} onPress={handleSave} disabled={saving} scaleTo={0.97}>
        <Text style={styles.buttonText}>{saving ? 'Saving...' : 'Save password'}</Text>
      </PressableScale>
    </AnimatedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: spacing.xl, backgroundColor: colors.bg },
  title: { ...typeScale.display, color: colors.text, marginBottom: spacing.md },
  body: { ...typeScale.body, color: colors.textMuted, marginBottom: spacing.xl },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    color: colors.text,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  button: { backgroundColor: colors.primary, padding: spacing.md + 2, borderRadius: radius.md, alignItems: 'center' },
  buttonText: { color: colors.white, fontWeight: '700' },
});
