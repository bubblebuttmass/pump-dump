import React, { useState } from 'react';
import { View, TextInput, Text, Pressable, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../../lib/supabase';
import { uploadAvatar } from '../../lib/storage';
import { useAuth } from '../../lib/auth';
import { showAlert } from '../../lib/alert';
import { AnimatedView } from '../../components/AnimatedScreen';
import { PressableScale } from '../../components/PressableScale';
import { colors, radius, spacing, type as typeScale } from '../../lib/theme';

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
      <PressableScale
        onPress={pickAvatar}
        style={styles.avatarPicker}
        scaleTo={0.95}
        accessibilityRole="button"
        accessibilityLabel="Choose profile photo"
      >
        {avatarUri ? (
          <Image source={{ uri: avatarUri }} style={styles.avatar} contentFit="cover" cachePolicy="memory-disk" />
        ) : (
          <Text style={styles.choosePhotoText}>Choose photo</Text>
        )}
      </PressableScale>
      <TextInput
        style={styles.input}
        placeholder="Display name"
        placeholderTextColor={colors.textFaint}
        value={displayName}
        onChangeText={setDisplayName}
        accessibilityLabel="Display name"
      />
      <PressableScale style={styles.button} onPress={handleSave} disabled={submitting} scaleTo={0.97}>
        <Text style={styles.buttonText}>{submitting ? 'Saving...' : 'Continue'}</Text>
      </PressableScale>
    </AnimatedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: spacing.xl, backgroundColor: colors.bg },
  title: { ...typeScale.display, color: colors.text, marginBottom: spacing.xl, textAlign: 'center' },
  avatarPicker: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.surfaceRaised,
    alignSelf: 'center',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  avatar: { width: 100, height: 100, borderRadius: 50 },
  choosePhotoText: { ...typeScale.caption, color: colors.textMuted },
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
