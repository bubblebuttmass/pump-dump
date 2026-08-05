import React, { useEffect, useState } from 'react';
import { View, TextInput, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../../../lib/auth';
import { getProfile, updateProfile, getUsernameCooldownDaysRemaining } from '../../../lib/profile';
import { uploadAvatar } from '../../../lib/storage';
import { showAlert } from '../../../lib/alert';
import { TRAIT_CATEGORIES } from '../../../lib/traits';
import { AnimatedView } from '../../../components/AnimatedScreen';
import { PressableScale } from '../../../components/PressableScale';
import { colors, radius, spacing, type as typeScale } from '../../../lib/theme';

export default function EditProfile() {
  const { session } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [gym, setGym] = useState('');
  const [favoriteLift, setFavoriteLift] = useState('');
  const [yearsLifting, setYearsLifting] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [traits, setTraits] = useState<string[]>([]);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [newAvatarUri, setNewAvatarUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [usernameCooldownDays, setUsernameCooldownDays] = useState(0);

  useEffect(() => {
    if (!session?.user) return;
    getProfile(session.user.id, session.user.id).then((profile) => {
      setDisplayName(profile.display_name);
      setBio(profile.bio ?? '');
      setGym(profile.gym ?? '');
      setFavoriteLift(profile.favoriteLift ?? '');
      setYearsLifting(profile.yearsLifting != null ? String(profile.yearsLifting) : '');
      setIsPrivate(profile.isPrivate);
      setTraits(profile.traits);
      setAvatarUrl(profile.avatar_url);
      setUsernameCooldownDays(getUsernameCooldownDaysRemaining(profile.usernameChangedAt));
      setLoading(false);
    });
  }, [session]);

  async function pickAvatar() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (!result.canceled) setNewAvatarUri(result.assets[0].uri);
  }

  function toggleTrait(trait: string) {
    setTraits((prev) => (prev.includes(trait) ? prev.filter((t) => t !== trait) : [...prev, trait]));
  }

  async function handleSave() {
    if (!session?.user) return;
    if (displayName.trim().length === 0) {
      showAlert('Display name required');
      return;
    }
    setSaving(true);
    try {
      const uploadedAvatarUrl = newAvatarUri ? await uploadAvatar(session.user.id, newAvatarUri) : undefined;
      await updateProfile(session.user.id, { displayName, bio, gym, favoriteLift, yearsLifting, isPrivate, traits, avatarUrl: uploadedAvatarUrl });
      router.back();
    } catch (e: any) {
      showAlert('Could not save profile', e.message ?? String(e));
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <AnimatedView style={styles.container}><View /></AnimatedView>;

  return (
    <AnimatedView style={styles.container}>
    <ScrollView contentContainerStyle={styles.scroll}>
      <PressableScale
        onPress={pickAvatar}
        style={styles.avatarPicker}
        scaleTo={0.95}
        accessibilityRole="button"
        accessibilityLabel="Change profile photo"
      >
        {newAvatarUri || avatarUrl ? (
          <Image source={{ uri: newAvatarUri ?? avatarUrl! }} style={styles.avatar} contentFit="cover" cachePolicy="memory-disk" />
        ) : (
          <Text style={styles.choosePhotoText}>Choose photo</Text>
        )}
      </PressableScale>
      <Text style={styles.label}>Display name</Text>
      <TextInput
        style={[styles.input, usernameCooldownDays > 0 && styles.inputDisabled]}
        value={displayName}
        onChangeText={setDisplayName}
        editable={usernameCooldownDays === 0}
        accessibilityLabel={
          usernameCooldownDays > 0
            ? `Display name, locked for ${usernameCooldownDays} day${usernameCooldownDays === 1 ? '' : 's'}`
            : 'Display name'
        }
      />
      {usernameCooldownDays > 0 && (
        <Text style={styles.usernameCooldownHint}>
          You can change your username again in {usernameCooldownDays} day{usernameCooldownDays === 1 ? '' : 's'}.
        </Text>
      )}
      <Text style={styles.label}>Bio</Text>
      <TextInput
        style={[styles.input, styles.bioInput]}
        value={bio}
        onChangeText={setBio}
        placeholder="Tell other lifters about yourself"
        placeholderTextColor={colors.textFaint}
        multiline
        maxLength={200}
        accessibilityLabel="Bio"
      />
      <Text style={styles.label}>Gym</Text>
      <TextInput
        style={styles.input}
        value={gym}
        onChangeText={setGym}
        placeholder="Where do you train?"
        placeholderTextColor={colors.textFaint}
        accessibilityLabel="Gym"
      />
      <Text style={styles.label}>Favorite lift</Text>
      <TextInput
        style={styles.input}
        value={favoriteLift}
        onChangeText={setFavoriteLift}
        placeholder="Squat, bench, deadlift..."
        placeholderTextColor={colors.textFaint}
        accessibilityLabel="Favorite lift"
      />
      <Text style={styles.label}>Years lifting</Text>
      <TextInput
        style={styles.input}
        value={yearsLifting}
        onChangeText={setYearsLifting}
        placeholder="e.g. 3"
        placeholderTextColor={colors.textFaint}
        keyboardType="number-pad"
        accessibilityLabel="Years lifting"
      />

      {TRAIT_CATEGORIES.map((category) => (
        <View key={category.label} style={styles.category}>
          <Text style={styles.label}>{category.label}</Text>
          <View style={styles.chipRow}>
            {category.options.map((option) => {
              const selected = traits.includes(option);
              return (
                <Pressable
                  key={option}
                  style={[styles.chip, selected && styles.chipSelected]}
                  onPress={() => toggleTrait(option)}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  accessibilityLabel={option}
                >
                  <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{option}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ))}

      <PressableScale style={styles.button} onPress={handleSave} disabled={saving} scaleTo={0.97}>
        <Text style={styles.buttonText}>{saving ? 'Saving...' : 'Save'}</Text>
      </PressableScale>
    </ScrollView>
    </AnimatedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: spacing.xl },
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
  label: { ...typeScale.subtitle, color: colors.text, marginBottom: spacing.xs },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    color: colors.text,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  bioInput: { minHeight: 80, textAlignVertical: 'top' },
  inputDisabled: { opacity: 0.5 },
  usernameCooldownHint: { ...typeScale.caption, color: colors.textFaint, marginTop: -spacing.md, marginBottom: spacing.lg },
  category: { marginBottom: spacing.lg },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    paddingHorizontal: spacing.md + 2,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
  chipTextSelected: { color: colors.white },
  button: { backgroundColor: colors.primary, padding: spacing.md + 2, borderRadius: radius.md, alignItems: 'center', marginTop: spacing.sm },
  buttonText: { color: colors.white, fontWeight: '700' },
});
