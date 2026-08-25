import React, { useMemo, useState } from 'react';
import { View, TextInput, Text, Pressable, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../../lib/supabase';
import { uploadAvatar } from '../../lib/storage';
import { useAuth } from '../../lib/auth';
import { showAlert } from '../../lib/alert';
import { AnimatedView } from '../../components/AnimatedScreen';
import { PressableScale } from '../../components/PressableScale';
import { useThemeColors, radius, spacing, type as typeScale, ThemeColors } from '../../lib/theme';

export default function Onboarding() {
  const { session } = useAuth();
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
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
    if (!session?.user) {
      // Previously a silent no-op -- if a sessionless user ever lands here
      // (stale/expired token, deep link, etc.) Continue looked broken:
      // tapping it produced no alert, no spinner, no navigation, nothing.
      // Surface it and send them somewhere that can actually recover.
      showAlert('You have been signed out', 'Please log in again to finish setting up your profile.');
      router.replace('/(auth)/login');
      return;
    }
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
      {/* Unlike every other form screen in the app, this one has no
          ScrollView to fall back on -- without keyboard avoidance, the
          keyboard opening for the display-name field could cover the
          Continue button entirely on iOS (which doesn't resize the root
          view for you), with no way to scroll down and reach it. */}
      <KeyboardAvoidingView
        style={styles.content}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Text style={styles.title}>Set up your profile</Text>
        <PressableScale
          onPress={pickAvatar}
          style={styles.avatarPicker}
          scaleTo={0.95}
          accessibilityRole="button"
          accessibilityLabel="Choose profile photo"
        >
          {avatarUri ? (
            <Image source={{ uri: avatarUri }} style={styles.avatar} contentFit="cover" cachePolicy="memory-disk" transition={200} />
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
      </KeyboardAvoidingView>
    </AnimatedView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    content: { flex: 1, justifyContent: 'center', padding: spacing.xl },
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
}
