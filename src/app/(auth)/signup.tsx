import React, { useState } from 'react';
import { View, TextInput, Text, Pressable, StyleSheet } from 'react-native';
import { Link, router } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { showAlert } from '../../lib/alert';
import { AnimatedView } from '../../components/AnimatedScreen';

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
      <Text style={styles.brand}>Pump.io</Text>
      <Text style={styles.title}>Create account</Text>
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
        placeholder="Password (min 8 characters)"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      <Pressable style={styles.button} onPress={handleSignup} disabled={submitting}>
        <Text style={styles.buttonText}>{submitting ? 'Creating...' : 'Sign up'}</Text>
      </Pressable>
      <Link href="/(auth)/login" style={styles.link}>
        <Text>Already have an account? Log in</Text>
      </Link>
    </AnimatedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24 },
  brand: { fontSize: 22, fontWeight: '700', color: '#4285F4', textAlign: 'center', marginBottom: 8 },
  title: { fontSize: 28, fontWeight: '700', marginBottom: 24 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, marginBottom: 12 },
  button: { backgroundColor: '#111', padding: 14, borderRadius: 8, alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: '600' },
  link: { marginTop: 16, alignSelf: 'center' },
});
