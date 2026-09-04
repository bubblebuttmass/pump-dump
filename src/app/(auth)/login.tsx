import React, { useMemo, useState } from 'react';
import { View, TextInput, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { Link, router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import * as AppleAuthentication from 'expo-apple-authentication';
import { supabase } from '../../lib/supabase';
import { showAlert } from '../../lib/alert';
import { AnimatedView } from '../../components/AnimatedScreen';
import { PressableScale } from '../../components/PressableScale';
import { useThemeColors, radius, spacing, type as typeScale, ThemeColors } from '../../lib/theme';

WebBrowser.maybeCompleteAuthSession();

export default function Login() {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleLogin() {
    setSubmitting(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setSubmitting(false);
    if (error) {
      showAlert('Login failed', error.message);
      return;
    }
    // Not a hardcoded feed destination -- '/' re-runs index.tsx's gate,
    // which is the one place that knows whether this account (an existing
    // one logging back in with onboarding still incomplete from an earlier
    // interrupted signup) still needs onboarding rather than the feed.
    router.replace('/');
  }

  async function handleGoogleLogin() {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: 'lifterapp://auth-callback', skipBrowserRedirect: true },
    });
    if (error || !data?.url) {
      showAlert('Google sign-in failed', error?.message ?? 'No auth URL returned');
      return;
    }
    const result = await WebBrowser.openAuthSessionAsync(data.url, 'lifterapp://auth-callback');
    if (result.type === 'success' && result.url) {
      const url = new URL(result.url);
      const access_token = url.hash.includes('access_token')
        ? new URLSearchParams(url.hash.substring(1)).get('access_token')
        : null;
      const refresh_token = url.hash.includes('refresh_token')
        ? new URLSearchParams(url.hash.substring(1)).get('refresh_token')
        : null;
      if (access_token && refresh_token) {
        await supabase.auth.setSession({ access_token, refresh_token });
        // Not a hardcoded feed destination -- '/' re-runs index.tsx's gate,
        // which is the one place that knows whether this account (new via
        // OAuth, and so still needing onboarding) should land there instead
        // of the feed.
        router.replace('/');
      }
    }
  }

  async function handleAppleLogin() {
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      if (!credential.identityToken) {
        showAlert('Apple sign-in failed', 'No identity token returned');
        return;
      }
      const { error } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: credential.identityToken,
      });
      if (error) {
        showAlert('Apple sign-in failed', error.message);
        return;
      }
      // Not a hardcoded feed destination -- '/' re-runs index.tsx's gate,
      // which is the one place that knows whether this account (new via
      // OAuth, or an existing one logging back in with onboarding still
      // incomplete from an earlier interrupted signup) still needs
      // onboarding rather than the feed.
      router.replace('/');
    } catch (e: any) {
      if (e.code !== 'ERR_REQUEST_CANCELED') showAlert('Apple sign-in failed', String(e));
    }
  }

  return (
    <AnimatedView style={styles.container}>
      <Text style={styles.brand}>Pump Dump</Text>
      <Text style={styles.title}>Log in</Text>
      <TextInput
        style={styles.input}
        placeholder="Email"
        placeholderTextColor={colors.textFaint}
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
        accessibilityLabel="Email"
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        placeholderTextColor={colors.textFaint}
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        accessibilityLabel="Password"
      />
      <PressableScale style={styles.button} onPress={handleLogin} disabled={submitting} scaleTo={0.97}>
        <Text style={styles.buttonText}>{submitting ? 'Logging in...' : 'Log in'}</Text>
      </PressableScale>
      <PressableScale style={styles.oauthButton} onPress={handleGoogleLogin} scaleTo={0.97}>
        <Text style={styles.buttonText}>Continue with Google</Text>
      </PressableScale>
      {Platform.OS === 'ios' && (
        <AppleAuthentication.AppleAuthenticationButton
          buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
          buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
          cornerRadius={8}
          style={{ width: '100%', height: 44, marginTop: 12 }}
          onPress={handleAppleLogin}
        />
      )}
      <Link href="/(auth)/forgot-password" style={styles.link}>
        <Text style={styles.linkText}>Forgot password?</Text>
      </Link>
      <Link href="/(auth)/signup" style={styles.link}>
        <Text style={styles.linkText}>Need an account? Sign up</Text>
      </Link>
    </AnimatedView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
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
    oauthButton: { backgroundColor: colors.surfaceRaised, padding: spacing.md + 2, borderRadius: radius.md, alignItems: 'center', marginTop: spacing.md },
    buttonText: { color: colors.white, fontWeight: '700' },
    link: { marginTop: spacing.lg, alignSelf: 'center' },
    linkText: { color: colors.textMuted },
  });
}
