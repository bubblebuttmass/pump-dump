import { supabase } from './supabase';

export interface Comment {
  id: string;
  user_id: string;
  display_name: string;
  body: string;
  created_at: string;
}

export async function toggleLike(userId: string, workoutId: string, currentlyLiked: boolean): Promise<void> {
  if (currentlyLiked) {
    const { error } = await supabase.from('likes').delete().eq('user_id', userId).eq('workout_id', workoutId);
    if (error) throw error;
  } else {
    const { error } = await supabase.from('likes').insert({ user_id: userId, workout_id: workoutId });
    if (error) throw error;
  }
}

export async function getComments(workoutId: string): Promise<Comment[]> {
  const { data, error } = await supabase
    .from('comments')
    .select('id, user_id, body, created_at, users:user_id ( display_name )')
    .eq('workout_id', workoutId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((c: any) => ({
    id: c.id,
    user_id: c.user_id,
    display_name: c.users?.display_name ?? 'Unknown',
    body: c.body,
    created_at: c.created_at,
  }));
}

export async function addComment(userId: string, workoutId: string, body: string): Promise<Comment> {
  const { data, error } = await supabase
    .from('comments')
    .insert({ user_id: userId, workout_id: workoutId, body })
    .select('id, user_id, body, created_at, users:user_id ( display_name )')
    .single();
  if (error) throw error;
  return {
    id: data.id,
    user_id: data.user_id,
    display_name: (data as any).users?.display_name ?? 'Unknown',
    body: data.body,
    created_at: data.created_at,
  };
}

export interface WorkoutDetailSet {
  exercise_name: string;
  weight: number;
  reps: number;
  unit: string;
  isPR: boolean;
}

export interface WorkoutDetail {
  id: string;
  display_name: string;
  created_at: string;
  sets: WorkoutDetailSet[];
  likeCount: number;
  likedByMe: boolean;
}

export async function getWorkoutDetail(workoutId: string, viewerId: string): Promise<WorkoutDetail> {
  const { data: workout, error } = await supabase
    .from('workouts')
    .select(
      `id, created_at, users:user_id ( display_name ),
       workout_sets ( id, weight, reps, unit, exercises ( name ) ),
       likes ( user_id ),
       personal_records ( workout_set_id )`
    )
    .eq('id', workoutId)
    .single();
  if (error) throw error;

  const w = workout as any;
  const prSetIds = new Set((w.personal_records ?? []).map((p: any) => p.workout_set_id));

  return {
    id: w.id,
    display_name: w.users?.display_name ?? 'Unknown',
    created_at: w.created_at,
    sets: (w.workout_sets ?? []).map((s: any) => ({
      exercise_name: s.exercises?.name ?? 'Exercise',
      weight: s.weight,
      reps: s.reps,
      unit: s.unit,
      isPR: prSetIds.has(s.id),
    })),
    likeCount: (w.likes ?? []).length,
    likedByMe: (w.likes ?? []).some((l: any) => l.user_id === viewerId),
  };
}
