import React, { useMemo, useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import NetInfo from '@react-native-community/netinfo';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../../../lib/auth';
import { searchExercises, addCustomExercise, Exercise } from '../../../lib/exercises';
import { saveWorkout, NewSetInput } from '../../../lib/workouts';
import { enqueueWorkout } from '../../../lib/offlineQueue';
import { showAlert } from '../../../lib/alert';
import { uploadWorkoutPhotos } from '../../../lib/storage';
import { getBadgeStats } from '../../../lib/profile';
import { computeBadges, Badge } from '../../../lib/badges';
import { getCurrentLocationOnce, getNearbyGyms, createGym, NearbyGym } from '../../../lib/gyms';
import { AnimatedScreen } from '../../../components/AnimatedScreen';
import { PressableScale } from '../../../components/PressableScale';
import { CelebrationModal } from '../../../components/CelebrationModal';
import { useThemeColors, radius, spacing, type as typeScale, ThemeColors } from '../../../lib/theme';

interface DraftSet extends NewSetInput {
  exerciseName: string;
}

const MUSCLE_GROUPS = [
  'Chest',
  'Back',
  'Shoulders',
  'Arms',
  'Legs',
  'Core',
  'Full Body',
  'Cardio',
  'Rest Day',
  'Upper',
  'Lower',
  'Chest/Back',
  'Arms/Shoulders',
  'Push',
  'Pull',
  'Biceps',
  'Triceps',
];
const MAX_PHOTOS = 3;

export default function LogWorkout() {
  const { session } = useAuth();
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [photoUris, setPhotoUris] = useState<string[]>([]);
  const [caption, setCaption] = useState('');
  const [muscleGroup, setMuscleGroup] = useState<string | null>(null);
  const [showLifts, setShowLifts] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<Exercise[]>([]);
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);
  const [weight, setWeight] = useState('');
  const [reps, setReps] = useState('');
  const [unit, setUnit] = useState<'kg' | 'lb'>('lb');
  const [draftSets, setDraftSets] = useState<DraftSet[]>([]);
  const [posting, setPosting] = useState(false);
  const [celebration, setCelebration] = useState<{ title: string; subtitle?: string; badges: Badge[] } | null>(null);

  const [showGymPicker, setShowGymPicker] = useState(false);
  const [gymLocating, setGymLocating] = useState(false);
  const [gymLocationDenied, setGymLocationDenied] = useState(false);
  const [pendingCoords, setPendingCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [nearbyGyms, setNearbyGyms] = useState<NearbyGym[]>([]);
  const [selectedGym, setSelectedGym] = useState<{ id: string; name: string } | null>(null);
  const [newGymName, setNewGymName] = useState('');

  async function handleTakePhoto() {
    if (photoUris.length >= MAX_PHOTOS) return;
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      showAlert('Camera access needed', 'Enable camera access in settings to snap your pump.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.7, allowsEditing: true, aspect: [1, 1] });
    if (!result.canceled) setPhotoUris((prev) => [...prev, result.assets[0].uri]);
  }

  async function handleChoosePhoto() {
    if (photoUris.length >= MAX_PHOTOS) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
      allowsMultipleSelection: true,
      selectionLimit: MAX_PHOTOS - photoUris.length,
    });
    if (!result.canceled) {
      setPhotoUris((prev) => [...prev, ...result.assets.map((a) => a.uri)].slice(0, MAX_PHOTOS));
    }
  }

  function handleRemovePhoto(index: number) {
    setPhotoUris((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSearch(text: string) {
    setSearchQuery(text);
    if (text.trim().length === 0) {
      setResults([]);
      return;
    }
    setResults(await searchExercises(text));
  }

  async function handleAddCustom() {
    if (!session?.user || searchQuery.trim().length === 0) return;
    const created = await addCustomExercise(searchQuery, session.user.id);
    setSelectedExercise(created);
    setResults([]);
  }

  function handleAddSet() {
    if (!selectedExercise || !weight || !reps) return;
    setDraftSets((prev) => [
      ...prev,
      {
        exerciseId: selectedExercise.id,
        exerciseName: selectedExercise.name,
        weight: parseFloat(weight),
        reps: parseInt(reps, 10),
        unit,
      },
    ]);
    setWeight('');
    setReps('');
  }

  // Location is requested here, lazily, only when someone actually opens
  // the gym picker -- never on screen load. One-shot fetch, not a
  // subscription, so there's nothing to clean up once it resolves.
  async function handleToggleGymPicker() {
    const opening = !showGymPicker;
    setShowGymPicker(opening);
    if (!opening || pendingCoords || gymLocationDenied) return;

    setGymLocating(true);
    const result = await getCurrentLocationOnce();
    setGymLocating(false);
    if (result.status === 'denied') {
      setGymLocationDenied(true);
      return;
    }
    if (result.status === 'error') {
      showAlert('Could not get location', result.message);
      return;
    }
    setPendingCoords(result.coords);
    try {
      setNearbyGyms(await getNearbyGyms(result.coords.lat, result.coords.lng));
    } catch (e: any) {
      showAlert('Could not load nearby gyms', e.message ?? String(e));
    }
  }

  function handleSelectGym(g: NearbyGym) {
    setSelectedGym({ id: g.id, name: g.name });
    setShowGymPicker(false);
  }

  function handleClearGym() {
    setSelectedGym(null);
  }

  async function handleCreateGym() {
    if (!session?.user || !pendingCoords || newGymName.trim().length === 0) return;
    try {
      const created = await createGym(newGymName.trim(), pendingCoords.lat, pendingCoords.lng, session.user.id);
      setSelectedGym({ id: created.id, name: created.name });
      setNewGymName('');
      setShowGymPicker(false);
    } catch (e: any) {
      showAlert('Could not add gym', e.message ?? String(e));
    }
  }

  function resetForm() {
    setPhotoUris([]);
    setCaption('');
    setMuscleGroup(null);
    setShowLifts(false);
    setDraftSets([]);
    setSelectedExercise(null);
    setShowGymPicker(false);
    setGymLocating(false);
    setGymLocationDenied(false);
    setPendingCoords(null);
    setNearbyGyms([]);
    setSelectedGym(null);
    setNewGymName('');
  }

  async function handlePost() {
    if (!session?.user) return;
    setPosting(true);
    try {
      const netState = await NetInfo.fetch();
      const sets = draftSets.map(({ exerciseId, weight, reps, unit }) => ({ exerciseId, weight, reps, unit }));

      if (!netState.isConnected) {
        // Photo upload requires a network round trip, so offline posts skip
        // the photo rather than trying to defer the upload itself.
        await enqueueWorkout({
          userId: session.user.id,
          title: muscleGroup ?? undefined,
          caption: caption.trim() || undefined,
          sets,
        });
        resetForm();
        showAlert('Saved offline', "This post will share once you're back online (without the photo).");
        return;
      }

      // beforeStats and the photo upload don't depend on each other --
      // running them together overlaps the badge-stats round trip with
      // the (usually much longer) upload instead of paying for both in
      // sequence before the workout can even be saved.
      const [beforeStats, photoUrls] = await Promise.all([
        getBadgeStats(session.user.id),
        photoUris.length > 0 ? uploadWorkoutPhotos(session.user.id, photoUris) : Promise.resolve(undefined),
      ]);
      const { newPRs } = await saveWorkout({
        userId: session.user.id,
        title: muscleGroup ?? undefined,
        caption: caption.trim() || undefined,
        photoUrls,
        gymId: selectedGym?.id,
        sets,
      });
      resetForm();

      const afterStats = await getBadgeStats(session.user.id);
      const beforeBadges = computeBadges(beforeStats);
      const afterBadges = computeBadges(afterStats);
      const newlyEarned = afterBadges.filter((b) => !beforeBadges.some((pb) => pb.id === b.id));

      if (newPRs.length > 0 || newlyEarned.length > 0) {
        setCelebration({
          title: newPRs.length > 0 ? 'New PR!' : 'Achievement Unlocked!',
          subtitle:
            newPRs.length > 0
              ? `You hit ${newPRs.length} new personal record${newPRs.length > 1 ? 's' : ''}!`
              : undefined,
          badges: newlyEarned,
        });
      } else {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        router.push('/(tabs)/feed');
      }
    } catch (e: any) {
      showAlert('Could not share pump', e.message ?? String(e));
    } finally {
      setPosting(false);
    }
  }

  function handleDismissCelebration() {
    setCelebration(null);
    router.push('/(tabs)/feed');
  }

  const canPost = photoUris.length > 0 || caption.trim().length > 0 || draftSets.length > 0;

  return (
    <AnimatedScreen style={styles.container}>
      <KeyboardAvoidingView
        style={styles.flex1}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Share your pump</Text>

        <View style={styles.photoSection}>
          {photoUris.length > 0 ? (
            <>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.thumbRow}>
                {photoUris.map((uri, i) => (
                  <View key={uri} style={styles.thumbWrap}>
                    <Image source={{ uri }} style={styles.thumb} contentFit="cover" />
                    <Pressable
                      style={styles.thumbRemove}
                      onPress={() => handleRemovePhoto(i)}
                      hitSlop={6}
                      accessibilityRole="button"
                      accessibilityLabel="Remove photo"
                    >
                      <Ionicons name="close" size={14} color={colors.white} />
                    </Pressable>
                  </View>
                ))}
                {photoUris.length < MAX_PHOTOS && (
                  <Pressable style={styles.addMoreTile} onPress={handleChoosePhoto} accessibilityRole="button" accessibilityLabel="Add another photo">
                    <Ionicons name="add" size={22} color={colors.textMuted} />
                  </Pressable>
                )}
              </ScrollView>
              <Text style={styles.photoCount}>{photoUris.length}/{MAX_PHOTOS} photos</Text>
            </>
          ) : (
            <View style={styles.row}>
              <Pressable style={styles.photoButton} onPress={handleTakePhoto}>
                <Text style={styles.photoButtonText}>Snap your pump</Text>
              </Pressable>
              <Pressable style={styles.photoButton} onPress={handleChoosePhoto}>
                <Text style={styles.photoButtonText}>Choose photo</Text>
              </Pressable>
            </View>
          )}
        </View>

        <TextInput
          style={[styles.input, styles.captionInput]}
          placeholder="What'd you hit today?"
          placeholderTextColor={colors.textFaint}
          value={caption}
          onChangeText={setCaption}
          multiline
          maxLength={280}
          accessibilityLabel="Caption"
        />

        <Text style={styles.label}>Muscle group</Text>
        <View style={styles.chipRow}>
          {MUSCLE_GROUPS.map((g) => (
            <Pressable
              key={g}
              style={[styles.chip, muscleGroup === g && styles.chipSelected]}
              onPress={() => setMuscleGroup(muscleGroup === g ? null : g)}
              accessibilityRole="button"
              accessibilityState={{ selected: muscleGroup === g }}
              accessibilityLabel={g}
            >
              <Text style={[styles.chipText, muscleGroup === g && styles.chipTextSelected]}>{g}</Text>
            </Pressable>
          ))}
        </View>

        {selectedGym ? (
          <View style={styles.gymPill}>
            <Ionicons name="location" size={14} color={colors.primary} />
            <Text style={styles.gymPillText}>{selectedGym.name}</Text>
            <Pressable onPress={handleClearGym} hitSlop={8} accessibilityRole="button" accessibilityLabel="Remove gym tag">
              <Ionicons name="close" size={14} color={colors.textFaint} />
            </Pressable>
          </View>
        ) : (
          <Pressable onPress={handleToggleGymPicker}>
            <Text style={styles.link}>{showGymPicker ? 'Hide gym search' : '+ Tag a gym (optional)'}</Text>
          </Pressable>
        )}

        {showGymPicker && !selectedGym && (
          <View style={styles.gymSection}>
            {gymLocating && <ActivityIndicator color={colors.primary} style={styles.gymSpinner} />}
            {gymLocationDenied && (
              <Text style={styles.gymHint}>
                Location access is off, so nearby gyms can't be found. Enable it in Settings to tag a gym.
              </Text>
            )}
            {!gymLocating && nearbyGyms.length > 0 && (
              <View style={styles.chipRow}>
                {nearbyGyms.map((g) => (
                  <Pressable key={g.id} style={styles.chip} onPress={() => handleSelectGym(g)} accessibilityRole="button" accessibilityLabel={g.name}>
                    <Text style={styles.chipText}>{g.name}</Text>
                  </Pressable>
                ))}
              </View>
            )}
            {!gymLocating && pendingCoords && (
              <View style={styles.row}>
                <TextInput
                  style={[styles.input, styles.flex1]}
                  placeholder="Don't see it? Add this gym"
                  placeholderTextColor={colors.textFaint}
                  value={newGymName}
                  onChangeText={setNewGymName}
                  accessibilityLabel="New gym name"
                />
                <Pressable style={styles.button} onPress={handleCreateGym} disabled={newGymName.trim().length === 0}>
                  <Text style={styles.buttonText}>Add</Text>
                </Pressable>
              </View>
            )}
          </View>
        )}

        <Pressable onPress={() => setShowLifts((v) => !v)}>
          <Text style={styles.link}>
            {showLifts ? 'Hide lift log' : '+ Log your lifts (optional)'}
            {draftSets.length > 0 ? ` (${draftSets.length})` : ''}
          </Text>
        </Pressable>

        {showLifts && (
          <View style={styles.liftsSection}>
            {!selectedExercise ? (
              <>
                <TextInput
                  style={styles.input}
                  placeholder="Search exercises..."
                  value={searchQuery}
                  onChangeText={handleSearch}
                  accessibilityLabel="Search exercises"
                />
                {results.map((item) => (
                  <Pressable key={item.id} style={styles.exerciseRow} onPress={() => setSelectedExercise(item)}>
                    <Text style={styles.exerciseRowText}>{item.name}</Text>
                  </Pressable>
                ))}
                {results.length === 0 && searchQuery.trim().length > 0 && (
                  <Pressable onPress={handleAddCustom}>
                    <Text style={styles.addCustom}>+ Add "{searchQuery}" as custom exercise</Text>
                  </Pressable>
                )}
              </>
            ) : (
              <View>
                <Text style={styles.selected}>{selectedExercise.name}</Text>
                <View style={styles.row}>
                  <TextInput
                    style={[styles.input, styles.flex1]}
                    placeholder="Weight"
                    keyboardType="numeric"
                    value={weight}
                    onChangeText={setWeight}
                    accessibilityLabel="Weight"
                  />
                  <TextInput
                    style={[styles.input, styles.flex1]}
                    placeholder="Reps"
                    keyboardType="numeric"
                    value={reps}
                    onChangeText={setReps}
                    accessibilityLabel="Reps"
                  />
                  <Pressable onPress={() => setUnit(unit === 'lb' ? 'kg' : 'lb')} style={styles.unitToggle}>
                    <Text style={styles.unitToggleText}>{unit}</Text>
                  </Pressable>
                </View>
                <Pressable style={styles.button} onPress={handleAddSet}>
                  <Text style={styles.buttonText}>Add Set</Text>
                </Pressable>
                <Pressable onPress={() => setSelectedExercise(null)}>
                  <Text style={styles.link}>Change exercise</Text>
                </Pressable>
              </View>
            )}

            {draftSets.map((item, i) => (
              <Text key={i} style={styles.setRow}>
                {item.exerciseName}: {item.weight}
                {item.unit} x {item.reps}
              </Text>
            ))}
          </View>
        )}

        <PressableScale style={styles.button} onPress={handlePost} disabled={posting || !canPost} scaleTo={0.97}>
          <Text style={styles.buttonText}>{posting ? 'Posting...' : 'Share Pump'}</Text>
        </PressableScale>
      </ScrollView>
      </KeyboardAvoidingView>
      <CelebrationModal
        visible={celebration !== null}
        title={celebration?.title ?? ''}
        subtitle={celebration?.subtitle}
        badges={celebration?.badges ?? []}
        onDismiss={handleDismissCelebration}
      />
    </AnimatedScreen>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    scroll: { padding: spacing.lg },
    title: { ...typeScale.display, color: colors.text, marginBottom: spacing.lg },
    label: { ...typeScale.subtitle, color: colors.text, marginBottom: spacing.sm },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      color: colors.text,
      borderRadius: radius.md,
      padding: spacing.md,
      marginBottom: spacing.sm,
    },
    captionInput: { minHeight: 70, textAlignVertical: 'top', marginBottom: spacing.lg },
    exerciseRow: { padding: spacing.md, borderBottomWidth: 1, borderColor: colors.border },
    exerciseRowText: { ...typeScale.body, color: colors.text },
    addCustom: { padding: spacing.md, color: colors.primary },
    selected: { ...typeScale.subtitle, color: colors.text, marginBottom: spacing.sm },
    row: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
    flex1: { flex: 1 },
    unitToggle: { padding: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md },
    unitToggleText: { ...typeScale.body, color: colors.text, fontWeight: '600' },
    button: { backgroundColor: colors.primary, padding: spacing.md + 2, borderRadius: radius.md, alignItems: 'center', marginTop: spacing.lg },
    buttonText: { color: colors.white, fontWeight: '700' },
    link: { color: colors.primary, marginTop: spacing.sm },
    setRow: { paddingVertical: spacing.xs, color: colors.textMuted },
    photoSection: { marginBottom: spacing.lg },
    photoButton: { flex: 1, backgroundColor: colors.surface, padding: spacing.md + 2, borderRadius: radius.md, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
    photoButtonText: { color: colors.text, fontWeight: '600' },
    thumbRow: { gap: spacing.sm },
    thumbWrap: { position: 'relative' },
    thumb: { width: 90, height: 90, borderRadius: radius.md },
    thumbRemove: {
      position: 'absolute',
      top: -6,
      right: -6,
      backgroundColor: colors.danger,
      borderRadius: 10,
      width: 20,
      height: 20,
      justifyContent: 'center',
      alignItems: 'center',
    },
    addMoreTile: {
      width: 90,
      height: 90,
      borderRadius: radius.md,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderStyle: 'dashed',
      justifyContent: 'center',
      alignItems: 'center',
    },
    photoCount: { ...typeScale.micro, color: colors.textFaint, marginTop: spacing.xs },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.sm },
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
    liftsSection: { marginTop: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 1, borderColor: colors.border },
    gymPill: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      gap: spacing.xs,
      backgroundColor: colors.primaryMuted,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: radius.pill,
      marginBottom: spacing.sm,
    },
    gymPillText: { ...typeScale.caption, color: colors.primary, fontWeight: '600' },
    gymSection: { marginBottom: spacing.md },
    gymSpinner: { marginVertical: spacing.sm },
    gymHint: { ...typeScale.caption, color: colors.textFaint, marginBottom: spacing.sm },
  });
}
