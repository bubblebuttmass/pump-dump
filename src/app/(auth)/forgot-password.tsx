import React, { useState } from 'react';
import { View, TextInput, Text, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { showAlert } from '../../lib/alert';
import { AnimatedView } from '../../components/AnimatedScreen';
import { PressableScale } from '../../components/PressableScale';
import { colors, radius, spacing, type as typeScale } from '../../lib/theme';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSend() {
    if (email.trim().length === 0) return;
    setSubmitting(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: 'lifterapp://reset-password',
    });
    setSubmitting(false);
    if (error) {
      showAlert('Could not send reset email', error.message);
      return;
    }
    setSent(true);
  }

  return (
    <AnimatedView style={styles.container}>
      <Text style={styles.title}>Reset password</Text>
      {sent ? (
        <>
          <Text style={styles.body}>
            If an account exists for {email.trim()}, we've sent a link to reset your password. Open it on this
            device to continue.
          </Text>
          <PressableScale style={styles.button} onPress={() => router.back()} scaleTo={0.97}>
            <Text style={styles.buttonText}>Back to log in</Text>
          </PressableScale>
        </>
      ) : (
        <>
          <Text style={styles.body}>Enter the email on your account and we'll send you a reset link.</Text>
          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor={colors.textFaint}
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
          <PressableScale style={styles.button} onPress={handleSend} disabled={submitting} scaleTo={0.97}>
            <Text style={styles.buttonText}>{submitting ? 'Sending...' : 'Send reset link'}</Text>
          </PressableScale>
        </>
      )}
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
