import React, { useState } from 'react';
import { View, TextInput, Text, Pressable, StyleSheet, Alert, Platform } from 'react-native';
import { Link, router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import * as AppleAuthentication from 'expo-apple-authentication';
import { supabase } from '../../lib/supabase';

WebBrowser.maybeCompleteAuthSession();

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleLogin() {
    setSubmitting(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setSubmitting(false);
    if (error) {
      Alert.alert('Login failed', error.message);
      return;
    }
    router.replace('/(tabs)/feed');
  }

  async function handleGoogleLogin() {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: 'lifterapp://auth-callback', skipBrowserRedirect: true },
    });
    if (error || !data?.url) {
      Alert.alert('Google sign-in failed', error?.message ?? 'No auth URL returned');
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
        router.replace('/(tabs)/feed');
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
        Alert.alert('Apple sign-in failed', 'No identity token returned');
        return;
      }
      const { error } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: credential.identityToken,
      });
      if (error) {
        Alert.alert('Apple sign-in failed', error.message);
        return;
      }
      router.replace('/(tabs)/feed');
    } catch (e: any) {
      if (e.code !== 'ERR_REQUEST_CANCELED') Alert.alert('Apple sign-in failed', String(e));
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Log in</Text>
      <TextInput
        style={styles.input}
        placeholder="Email"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      <Pressable style={styles.button} onPress={handleLogin} disabled={submitting}>
        <Text style={styles.buttonText}>{submitting ? 'Logging in...' : 'Log in'}</Text>
      </Pressable>
      <Pressable style={styles.oauthButton} onPress={handleGoogleLogin}>
        <Text style={styles.buttonText}>Continue with Google</Text>
      </Pressable>
      {Platform.OS === 'ios' && (
        <AppleAuthentication.AppleAuthenticationButton
          buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
          buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
          cornerRadius={8}
          style={{ width: '100%', height: 44, marginTop: 12 }}
          onPress={handleAppleLogin}
        />
      )}
      <Link href="/(auth)/signup" style={styles.link}>
        <Text>Need an account? Sign up</Text>
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24 },
  title: { fontSize: 28, fontWeight: '700', marginBottom: 24 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, marginBottom: 12 },
  button: { backgroundColor: '#111', padding: 14, borderRadius: 8, alignItems: 'center' },
  oauthButton: { backgroundColor: '#4285F4', padding: 14, borderRadius: 8, alignItems: 'center', marginTop: 12 },
  buttonText: { color: '#fff', fontWeight: '600' },
  link: { marginTop: 16, alignSelf: 'center' },
});
