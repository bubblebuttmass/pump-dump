import { supabase } from './supabase';
import { checkForPR } from './pr';
import { deleteWorkoutPhotos } from './storage';

export interface NewSetInput {
  exerciseId: string;
  weight: number;
  reps: number;
  unit: 'kg' | 'lb';
}

export interface NewWorkoutInput {
  userId: string;
  title?: string;
  caption?: string;
  notes?: string;
  durationMin?: number;
  photoUrls?: string[];
  sets: NewSetInput[];
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
      caption: input.caption ?? null,
      notes: input.notes ?? null,
      duration_min: input.durationMin ?? null,
      photo_url: input.photoUrls?.[0] ?? null,
      photo_urls: input.photoUrls && input.photoUrls.length > 0 ? input.photoUrls : null,
    })
    .select()
    .single();
  if (workoutError) throw workoutError;

  // Logging lifts is optional now -- a pump pic with just a caption is a
  // complete post, so skip the (empty) insert rather than send it.
  if (input.sets.length === 0) {
    return { workoutId: workout.id, newPRs: [] };
  }

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

  // One query for every exercise's prior best instead of one per exercise --
  // and one batched insert for every new PR found, instead of a round trip
  // per PR. Both used to happen inside the set-by-set loop below.
  const uniqueExerciseIds = [...new Set(insertedSets.map((s) => s.exercise_id))];
  const { data: priorPRs, error: priorPRsError } = await supabase
    .from('personal_records')
    .select('exercise_id, estimated_1rm')
    .eq('user_id', input.userId)
    .in('exercise_id', uniqueExerciseIds);
  if (priorPRsError) throw priorPRsError;

  const runningBest = new Map<string, number | null>();
  for (const pr of priorPRs ?? []) {
    const current = runningBest.get(pr.exercise_id);
    if (current == null || pr.estimated_1rm > current) runningBest.set(pr.exercise_id, pr.estimated_1rm);
  }

  const newPRs: NewPR[] = [];
  const prRowsToInsert: {
    user_id: string;
    exercise_id: string;
    weight: number;
    reps: number;
    estimated_1rm: number;
    workout_set_id: string;
  }[] = [];

  for (const set of insertedSets) {
    const priorBest = runningBest.get(set.exercise_id) ?? null;
    const { isNewPR, estimated1RM } = checkForPR({ weight: set.weight, reps: set.reps }, priorBest);

    if (isNewPR) {
      runningBest.set(set.exercise_id, estimated1RM);
      newPRs.push({ exerciseId: set.exercise_id, estimated1RM });
      prRowsToInsert.push({
        user_id: input.userId,
        exercise_id: set.exercise_id,
        weight: set.weight,
        reps: set.reps,
        estimated_1rm: estimated1RM,
        workout_set_id: set.id,
      });
    }
  }

  if (prRowsToInsert.length > 0) {
    const { error: prError } = await supabase.from('personal_records').insert(prRowsToInsert);
    if (prError) throw prError;
  }

  return { workoutId: workout.id, newPRs };
}

// workout_sets/likes/comments/bookmarks/notifications all cascade-delete on
// workouts(id) already, so the row delete alone leaves the DB consistent.
// personal_records.workout_set_id is ON DELETE SET NULL rather than
// cascade -- a PR you hit stays a real PR even if you later delete the post
// it came from, it just loses the link back to that specific post.
export async function deleteWorkout(workoutId: string, photoUrls: string[]): Promise<void> {
  const { error } = await supabase.from('workouts').delete().eq('id', workoutId);
  if (error) throw error;
  if (photoUrls.length > 0) {
    await deleteWorkoutPhotos(photoUrls);
  }
}
