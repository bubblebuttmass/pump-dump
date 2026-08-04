import React, { useState } from 'react';
import { View, TextInput, Text, Pressable, StyleSheet } from 'react-native';
import { Link, router } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { showAlert } from '../../lib/alert';
import { AnimatedView } from '../../components/AnimatedScreen';
import { PressableScale } from '../../components/PressableScale';
import { colors, radius, spacing, type as typeScale } from '../../lib/theme';

export default function Signup() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSignup() {
    if (password.length < 8) {
      showAlert('Password too short', 'Use at least 8 characters.');
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.auth.signUp({ email, password });
    setSubmitting(false);
    if (error) {
      showAlert('Sign up failed', error.message);
      return;
    }
    router.replace('/(auth)/onboarding');
  }

  return (
    <AnimatedView style={styles.container}>
      <Text style={styles.brand}>Pump Dump</Text>
      <Text style={styles.title}>Create account</Text>
      <TextInput
        style={styles.input}
        placeholder="Email"
        placeholderTextColor={colors.textFaint}
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder="Password (min 8 characters)"
        placeholderTextColor={colors.textFaint}
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      <PressableScale style={styles.button} onPress={handleSignup} disabled={submitting} scaleTo={0.97}>
        <Text style={styles.buttonText}>{submitting ? 'Creating...' : 'Sign up'}</Text>
      </PressableScale>
      <Link href="/(auth)/login" style={styles.link}>
        <Text style={styles.linkText}>Already have an account? Log in</Text>
      </Link>
    </AnimatedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: spacing.xl, backgroundColor: colors.bg },
  brand: { ...typeScale.subtitle, color: colors.primary, textAlign: 'center', marginBottom: spacing.sm },
  title: { ...typeScale.display, color: colors.text, marginBottom: spacing.xl },
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
  link: { marginTop: spacing.lg, alignSelf: 'center' },
  linkText: { color: colors.textMuted },
});
