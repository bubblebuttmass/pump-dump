import React, { useEffect, useRef, useState } from 'react';
import { View, TextInput, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../../lib/supabase';
import { uploadAvatar } from '../../lib/storage';
import { useAuth } from '../../lib/auth';
import { isUsernameTaken, toProfileSaveError } from '../../lib/profile';
import { showAlert } from '../../lib/alert';
import { AnimatedView } from '../../components/AnimatedScreen';
import { PressableScale } from '../../components/PressableScale';
import { colors, radius, spacing, type as typeScale } from '../../lib/theme';

type UsernameStatus = 'idle' | 'checking' | 'available' | 'taken';

const CHECK_DEBOUNCE_MS = 400;

export default function Onboarding() {
  const { session, markOnboardingComplete } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState<UsernameStatus>('idle');
  const checkTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced live availability check -- the unique index in migration 0027
  // is the actual enforcement (see handleSave's catch), this is just early
  // feedback so someone doesn't fill out the rest of the form before
  // finding out the name they wanted is gone.
  useEffect(() => {
    if (checkTimer.current) clearTimeout(checkTimer.current);
    const trimmed = displayName.trim();
    if (!session?.user || trimmed.length === 0) {
      setUsernameStatus('idle');
      return;
    }
    setUsernameStatus('checking');
    checkTimer.current = setTimeout(async () => {
      try {
        const taken = await isUsernameTaken(trimmed, session.user.id);
        setUsernameStatus(taken ? 'taken' : 'available');
      } catch {
        // Best-effort -- if the check itself fails, don't block the user on
        // it. The save's own unique-constraint catch still guards this.
        setUsernameStatus('idle');
      }
    }, CHECK_DEBOUNCE_MS);
    return () => {
      if (checkTimer.current) clearTimeout(checkTimer.current);
    };
  }, [displayName, session?.user]);

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
      showAlert('Username required');
      return;
    }
    if (!avatarUri) {
      showAlert('Profile photo required', 'Choose a photo to finish setting up your account.');
      return;
    }
    if (usernameStatus === 'taken') {
      showAlert('That username is already taken', 'Try a different one.');
      return;
    }
    setSubmitting(true);
    try {
      const avatarUrl = await uploadAvatar(session.user.id, avatarUri);

      const { error } = await supabase
        .from('users')
        .update({ display_name: displayName.trim(), avatar_url: avatarUrl, onboarding_completed_at: new Date().toISOString() })
        .eq('id', session.user.id);
      if (error) throw toProfileSaveError(error);

      markOnboardingComplete();
      router.replace('/(tabs)/feed');
    } catch (e: any) {
      showAlert('Could not save profile', e.message ?? String(e));
    } finally {
      setSubmitting(false);
    }
  }

  const canSubmit = !submitting && usernameStatus !== 'taken' && usernameStatus !== 'checking';

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
          <Image source={{ uri: avatarUri }} style={styles.avatar} contentFit="cover" cachePolicy="memory-disk" transition={200} />
        ) : (
          <Text style={styles.choosePhotoText}>Choose photo</Text>
        )}
      </PressableScale>
      <TextInput
        style={styles.input}
        placeholder="Username"
        placeholderTextColor={colors.textFaint}
        value={displayName}
        onChangeText={setDisplayName}
        autoCapitalize="none"
        autoCorrect={false}
        accessibilityLabel="Username"
      />
      {usernameStatus === 'checking' && <Text style={styles.usernameHint}>Checking availability...</Text>}
      {usernameStatus === 'taken' && <Text style={[styles.usernameHint, styles.usernameHintTaken]}>That username is already taken</Text>}
      {usernameStatus === 'available' && <Text style={[styles.usernameHint, styles.usernameHintAvailable]}>Username available</Text>}
      <PressableScale style={[styles.button, !canSubmit && styles.buttonDisabled]} onPress={handleSave} disabled={!canSubmit} scaleTo={0.97}>
        {submitting ? (
          <View style={styles.buttonRow}>
            <ActivityIndicator color={colors.white} size="small" />
            <Text style={styles.buttonText}>Saving...</Text>
          </View>
        ) : (
          <Text style={styles.buttonText}>Continue</Text>
        )}
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
  usernameHint: { ...typeScale.caption, color: colors.textFaint, marginTop: -spacing.sm, marginBottom: spacing.md },
  usernameHintTaken: { color: colors.danger },
  usernameHintAvailable: { color: colors.success },
  button: { backgroundColor: colors.primary, padding: spacing.md + 2, borderRadius: radius.md, alignItems: 'center' },
  buttonDisabled: { opacity: 0.6 },
  buttonRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  buttonText: { color: colors.white, fontWeight: '700' },
});
