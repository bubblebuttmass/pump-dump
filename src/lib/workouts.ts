import { supabase } from './supabase';

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

export async function saveWorkout(input: NewWorkoutInput): Promise<{ workoutId: string }> {
  const { data: workout, error: workoutError } = await supabase
    .from('workouts')
    .insert({
      user_id: input.userId,
      title: input.title ?? null,
      notes: input.notes ?? null,
      duration_min: input.durationMin ?? null,
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

  const { error: setsError } = await supabase.from('workout_sets').insert(setsToInsert);
  if (setsError) throw setsError;

  return { workoutId: workout.id };
}
