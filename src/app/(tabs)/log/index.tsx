import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, FlatList, Image, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import NetInfo from '@react-native-community/netinfo';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../../../lib/auth';
import { searchExercises, addCustomExercise, Exercise } from '../../../lib/exercises';
import { saveWorkout, NewSetInput } from '../../../lib/workouts';
import { enqueueWorkout } from '../../../lib/offlineQueue';
import { showAlert } from '../../../lib/alert';
import { uploadWorkoutPhoto } from '../../../lib/storage';

interface DraftSet extends NewSetInput {
  exerciseName: string;
}

export default function LogWorkout() {
  const { session } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<Exercise[]>([]);
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);
  const [weight, setWeight] = useState('');
  const [reps, setReps] = useState('');
  const [unit, setUnit] = useState<'kg' | 'lb'>('lb');
  const [draftSets, setDraftSets] = useState<DraftSet[]>([]);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [saving, setSaving] = useState(false);

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

  async function handleSaveWorkout() {
    if (!session?.user || draftSets.length === 0) return;
    setSaving(true);
    try {
      const netState = await NetInfo.fetch();

      if (!netState.isConnected) {
        // Photo upload requires a network round trip, so offline saves skip
        // the photo rather than trying to defer the upload itself.
        await enqueueWorkout({
          userId: session.user.id,
          title: title.trim() || undefined,
          sets: draftSets.map(({ exerciseId, weight, reps, unit }) => ({ exerciseId, weight, reps, unit })),
        });
        setDraftSets([]);
        setSelectedExercise(null);
        setPhotoUri(null);
        setTitle('');
        showAlert('Saved offline', "This workout will sync once you're back online (without the photo).");
        return;
      }

      const photoUrl = photoUri ? await uploadWorkoutPhoto(session.user.id, photoUri) : undefined;
      const { newPRs } = await saveWorkout({
        userId: session.user.id,
        title: title.trim() || undefined,
        photoUrl,
        sets: draftSets.map(({ exerciseId, weight, reps, unit }) => ({ exerciseId, weight, reps, unit })),
      });
      setDraftSets([]);
      setSelectedExercise(null);
      setPhotoUri(null);
      setTitle('');
      if (newPRs.length > 0) {
        showAlert('New PR!', `You hit ${newPRs.length} new personal record${newPRs.length > 1 ? 's' : ''}!`);
      }
      router.push('/(tabs)/feed');
    } catch (e: any) {
      showAlert('Could not save workout', e.message ?? String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Log Workout</Text>

      <TextInput
        style={styles.input}
        placeholder="Workout title (optional) — e.g. Upper day"
        value={title}
        onChangeText={setTitle}
      />

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

      {!selectedExercise ? (
        <>
          <TextInput
            style={styles.input}
            placeholder="Search exercises..."
            value={searchQuery}
            onChangeText={handleSearch}
          />
          <FlatList
            data={results}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <Pressable style={styles.exerciseRow} onPress={() => setSelectedExercise(item)}>
                <Text>{item.name}</Text>
              </Pressable>
            )}
            ListEmptyComponent={
              searchQuery.trim().length > 0 ? (
                <Pressable onPress={handleAddCustom}>
                  <Text style={styles.addCustom}>+ Add "{searchQuery}" as custom exercise</Text>
                </Pressable>
              ) : null
            }
          />
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

      <FlatList
        data={draftSets}
        keyExtractor={(_, i) => String(i)}
        renderItem={({ item }) => (
          <Text style={styles.setRow}>
            {item.exerciseName}: {item.weight}
            {item.unit} x {item.reps}
          </Text>
        )}
      />

      {draftSets.length > 0 && (
        <Pressable style={styles.button} onPress={handleSaveWorkout} disabled={saving}>
          <Text style={styles.buttonText}>
            {saving ? 'Saving...' : `Save Workout (${draftSets.length} set${draftSets.length > 1 ? 's' : ''})`}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 16 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, marginBottom: 8 },
  exerciseRow: { padding: 12, borderBottomWidth: 1, borderColor: '#eee' },
  addCustom: { padding: 12, color: '#0066cc' },
  selected: { fontSize: 18, fontWeight: '600', marginBottom: 8 },
  row: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  flex1: { flex: 1 },
  unitToggle: { padding: 12, borderWidth: 1, borderColor: '#ccc', borderRadius: 8 },
  button: { backgroundColor: '#111', padding: 14, borderRadius: 8, alignItems: 'center', marginTop: 8 },
  buttonText: { color: '#fff', fontWeight: '600' },
  link: { color: '#0066cc', marginTop: 8 },
  setRow: { paddingVertical: 6 },
  photoSection: { marginBottom: 16 },
  photoButton: { flex: 1, backgroundColor: '#f5f5f5', padding: 14, borderRadius: 8, alignItems: 'center' },
  photoButtonText: { color: '#111', fontWeight: '600' },
  photoPreview: { width: '100%', height: 200, borderRadius: 8 },
});
