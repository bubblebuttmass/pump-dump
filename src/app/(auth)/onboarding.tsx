import React, { useState } from 'react';
import { View, TextInput, Text, Pressable, Image, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../../lib/supabase';
import { uploadAvatar } from '../../lib/storage';
import { useAuth } from '../../lib/auth';
import { showAlert } from '../../lib/alert';
import { AnimatedView } from '../../components/AnimatedScreen';

export default function Onboarding() {
  const { session } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function pickAvatar() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (!result.canceled) setAvatarUri(result.assets[0].uri);
  }

  async function handleSave() {
    if (!session?.user) return;
    if (displayName.trim().length === 0) {
      showAlert('Display name required');
      return;
    }
    setSubmitting(true);
    try {
      let avatarUrl: string | null = null;
      if (avatarUri) avatarUrl = await uploadAvatar(session.user.id, avatarUri);

      const { error } = await supabase
        .from('users')
        .update({ display_name: displayName.trim(), ...(avatarUrl ? { avatar_url: avatarUrl } : {}) })
        .eq('id', session.user.id);
      if (error) throw error;

      router.replace('/(tabs)/feed');
    } catch (e: any) {
      showAlert('Could not save profile', e.message ?? String(e));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AnimatedView style={styles.container}>
      <Text style={styles.title}>Set up your profile</Text>
      <Pressable onPress={pickAvatar} style={styles.avatarPicker}>
        {avatarUri ? (
          <Image source={{ uri: avatarUri }} style={styles.avatar} />
        ) : (
          <Text>Choose photo</Text>
        )}
      </Pressable>
      <TextInput
        style={styles.input}
        placeholder="Display name"
        value={displayName}
        onChangeText={setDisplayName}
      />
      <Pressable style={styles.button} onPress={handleSave} disabled={submitting}>
        <Text style={styles.buttonText}>{submitting ? 'Saving...' : 'Continue'}</Text>
      </Pressable>
    </AnimatedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24 },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 24 },
  avatarPicker: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#eee',
    alignSelf: 'center',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  avatar: { width: 100, height: 100, borderRadius: 50 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, marginBottom: 12 },
  button: { backgroundColor: '#111', padding: 14, borderRadius: 8, alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: '600' },
});
