import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, FlatList, StyleSheet, Alert } from 'react-native';
import { router } from 'expo-router';
import NetInfo from '@react-native-community/netinfo';
import { useAuth } from '../../../lib/auth';
import { searchExercises, addCustomExercise, Exercise } from '../../../lib/exercises';
import { saveWorkout, NewSetInput } from '../../../lib/workouts';
import { enqueueWorkout } from '../../../lib/offlineQueue';

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
  const [saving, setSaving] = useState(false);

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
      const workoutInput = {
        userId: session.user.id,
        sets: draftSets.map(({ exerciseId, weight, reps, unit }) => ({ exerciseId, weight, reps, unit })),
      };

      if (!netState.isConnected) {
        await enqueueWorkout(workoutInput);
        setDraftSets([]);
        setSelectedExercise(null);
        Alert.alert('Saved offline', "This workout will sync once you're back online.");
        return;
      }

      const { newPRs } = await saveWorkout(workoutInput);
      setDraftSets([]);
      setSelectedExercise(null);
      if (newPRs.length > 0) {
        Alert.alert('New PR!', `You hit ${newPRs.length} new personal record${newPRs.length > 1 ? 's' : ''}!`);
      }
      router.push('/(tabs)/feed');
    } catch (e: any) {
      Alert.alert('Could not save workout', e.message ?? String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Log Workout</Text>

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
          <Text style={styles.buttonText}>{saving ? 'Saving...' : `Save Workout (${draftSets.length} sets)`}</Text>
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
});
