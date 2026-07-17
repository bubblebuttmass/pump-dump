import { supabase } from './supabase';
import { checkForPR } from './pr';

export interface NewSetInput {
  exerciseId: string;
  weight: number;
  reps: number;
  unit: 'kg' | 'lb';
}

export interface NewWorkoutInput {
  userId: string;
  title?: string;
  notes?: string;
  durationMin?: number;
  photoUrl?: string;
  sets: NewSetInput[];
}

export async function getBest1RM(userId: string, exerciseId: string): Promise<number | null> {
  const { data, error } = await supabase
    .from('personal_records')
    .select('estimated_1rm')
    .eq('user_id', userId)
    .eq('exercise_id', exerciseId)
    .order('estimated_1rm', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data?.estimated_1rm ?? null;
}

export interface NewPR {
  exerciseId: string;
  estimated1RM: number;
}

export async function saveWorkout(input: NewWorkoutInput): Promise<{ workoutId: string; newPRs: NewPR[] }> {
  const { data: workout, error: workoutError } = await supabase
    .from('workouts')
    .insert({
      user_id: input.userId,
      title: input.title ?? null,
      notes: input.notes ?? null,
      duration_min: input.durationMin ?? null,
      photo_url: input.photoUrl ?? null,
    })
    .select()
    .single();
  if (workoutError) throw workoutError;

  const setsToInsert = input.sets.map((s, index) => ({
    workout_id: workout.id,
    exercise_id: s.exerciseId,
    set_order: index,
    weight: s.weight,
    reps: s.reps,
    unit: s.unit,
  }));

  const { data: insertedSets, error: setsError } = await supabase
    .from('workout_sets')
    .insert(setsToInsert)
    .select();
  if (setsError) throw setsError;

  // Track the running best per exercise within this save, seeded from the DB.
  const runningBest = new Map<string, number | null>();
  const newPRs: NewPR[] = [];

  for (const set of insertedSets) {
    if (!runningBest.has(set.exercise_id)) {
      runningBest.set(set.exercise_id, await getBest1RM(input.userId, set.exercise_id));
    }
    const priorBest = runningBest.get(set.exercise_id) ?? null;
    const { isNewPR, estimated1RM } = checkForPR({ weight: set.weight, reps: set.reps }, priorBest);

    if (isNewPR) {
      const { error: prError } = await supabase.from('personal_records').insert({
        user_id: input.userId,
        exercise_id: set.exercise_id,
        weight: set.weight,
        reps: set.reps,
        estimated_1rm: estimated1RM,
        workout_set_id: set.id,
      });
      if (prError) throw prError;
      runningBest.set(set.exercise_id, estimated1RM);
      newPRs.push({ exerciseId: set.exercise_id, estimated1RM });
    }
  }

  return { workoutId: workout.id, newPRs };
}
