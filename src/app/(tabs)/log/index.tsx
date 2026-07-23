import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, Image, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import NetInfo from '@react-native-community/netinfo';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../../../lib/auth';
import { searchExercises, addCustomExercise, Exercise } from '../../../lib/exercises';
import { saveWorkout, NewSetInput } from '../../../lib/workouts';
import { enqueueWorkout } from '../../../lib/offlineQueue';
import { showAlert } from '../../../lib/alert';
import { uploadWorkoutPhoto } from '../../../lib/storage';
import { AnimatedScreen } from '../../../components/AnimatedScreen';

interface DraftSet extends NewSetInput {
  exerciseName: string;
}

const MUSCLE_GROUPS = ['Chest', 'Back', 'Shoulders', 'Arms', 'Legs', 'Core', 'Full Body', 'Cardio', 'Rest Day'];

export default function LogWorkout() {
  const { session } = useAuth();
  const [photoUri, setPhotoUri] = useState<string | null>(null);
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

  async function handleTakePhoto() {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      showAlert('Camera access needed', 'Enable camera access in settings to snap your pump.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.7, allowsEditing: true, aspect: [1, 1] });
    if (!result.canceled) setPhotoUri(result.assets[0].uri);
  }

  async function handleChoosePhoto() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (!result.canceled) setPhotoUri(result.assets[0].uri);
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

  function resetForm() {
    setPhotoUri(null);
    setCaption('');
    setMuscleGroup(null);
    setShowLifts(false);
    setDraftSets([]);
    setSelectedExercise(null);
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

      const photoUrl = photoUri ? await uploadWorkoutPhoto(session.user.id, photoUri) : undefined;
      const { newPRs } = await saveWorkout({
        userId: session.user.id,
        title: muscleGroup ?? undefined,
        caption: caption.trim() || undefined,
        photoUrl,
        sets,
      });
      resetForm();
      if (newPRs.length > 0) {
        showAlert('New PR!', `You hit ${newPRs.length} new personal record${newPRs.length > 1 ? 's' : ''}!`);
      }
      router.push('/(tabs)/feed');
    } catch (e: any) {
      showAlert('Could not share pump', e.message ?? String(e));
    } finally {
      setPosting(false);
    }
  }

  const canPost = !!photoUri || caption.trim().length > 0 || draftSets.length > 0;

  return (
    <AnimatedScreen style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Share your pump</Text>

        <View style={styles.photoSection}>
          {photoUri ? (
            <Pressable onPress={() => setPhotoUri(null)}>
              <Image source={{ uri: photoUri }} style={styles.photoPreview} />
              <Text style={styles.link}>Remove photo</Text>
            </Pressable>
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
          value={caption}
          onChangeText={setCaption}
          multiline
          maxLength={280}
        />

        <Text style={styles.label}>Muscle group</Text>
        <View style={styles.chipRow}>
          {MUSCLE_GROUPS.map((g) => (
            <Pressable
              key={g}
              style={[styles.chip, muscleGroup === g && styles.chipSelected]}
              onPress={() => setMuscleGroup(muscleGroup === g ? null : g)}
            >
              <Text style={[styles.chipText, muscleGroup === g && styles.chipTextSelected]}>{g}</Text>
            </Pressable>
          ))}
        </View>

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
                />
                {results.map((item) => (
                  <Pressable key={item.id} style={styles.exerciseRow} onPress={() => setSelectedExercise(item)}>
                    <Text>{item.name}</Text>
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
                  />
                  <TextInput
                    style={[styles.input, styles.flex1]}
                    placeholder="Reps"
                    keyboardType="numeric"
                    value={reps}
                    onChangeText={setReps}
                  />
                  <Pressable onPress={() => setUnit(unit === 'lb' ? 'kg' : 'lb')} style={styles.unitToggle}>
                    <Text>{unit}</Text>
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

        <Pressable style={styles.button} onPress={handlePost} disabled={posting || !canPost}>
          <Text style={styles.buttonText}>{posting ? 'Posting...' : 'Share Pump'}</Text>
        </Pressable>
      </ScrollView>
    </AnimatedScreen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 16 },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 16 },
  label: { fontWeight: '600', marginBottom: 8 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, marginBottom: 8 },
  captionInput: { minHeight: 70, textAlignVertical: 'top', marginBottom: 16 },
  exerciseRow: { padding: 12, borderBottomWidth: 1, borderColor: '#eee' },
  addCustom: { padding: 12, color: '#0066cc' },
  selected: { fontSize: 18, fontWeight: '600', marginBottom: 8 },
  row: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  flex1: { flex: 1 },
  unitToggle: { padding: 12, borderWidth: 1, borderColor: '#ccc', borderRadius: 8 },
  button: { backgroundColor: '#111', padding: 14, borderRadius: 8, alignItems: 'center', marginTop: 16 },
  buttonText: { color: '#fff', fontWeight: '600' },
  link: { color: '#0066cc', marginTop: 8 },
  setRow: { paddingVertical: 6 },
  photoSection: { marginBottom: 16 },
  photoButton: { flex: 1, backgroundColor: '#f5f5f5', padding: 14, borderRadius: 8, alignItems: 'center' },
  photoButtonText: { color: '#111', fontWeight: '600' },
  photoPreview: { width: '100%', height: 200, borderRadius: 8 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#eee',
  },
  chipSelected: { backgroundColor: '#111', borderColor: '#111' },
  chipText: { color: '#333', fontSize: 13, fontWeight: '600' },
  chipTextSelected: { color: '#fff' },
  liftsSection: { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderColor: '#eee' },
});
