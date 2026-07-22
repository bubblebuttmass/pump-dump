import { supabase } from './supabase';

export interface FeedSet {
  exercise_name: string;
  weight: number;
  reps: number;
  unit: string;
}

export interface FeedPost {
  id: string;
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  title: string | null;
  caption: string | null;
  photo_url: string | null;
  created_at: string;
  sets: FeedSet[];
  hasPR: boolean;
  likeCount: number;
  likedByMe: boolean;
  commentCount: number;
}

export async function getFeed(userId: string): Promise<FeedPost[]> {
  const { data: workouts, error } = await supabase
    .from('workouts')
    .select(
      `id, user_id, title, caption, photo_url, created_at,
       users:user_id ( display_name, avatar_url ),
       workout_sets ( weight, reps, unit, exercises ( name ), id, personal_records ( workout_set_id ) ),
       likes ( user_id ),
       comments ( id )`
    )
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw error;

  return (workouts ?? []).map((w: any) => {
    const prSetIds = new Set(
      (w.workout_sets ?? []).flatMap((s: any) => (s.personal_records ?? []).map((p: any) => p.workout_set_id))
    );
    return {
      id: w.id,
      user_id: w.user_id,
      display_name: w.users?.display_name ?? 'Unknown',
      avatar_url: w.users?.avatar_url ?? null,
      title: w.title,
      caption: w.caption ?? null,
      photo_url: w.photo_url ?? null,
      created_at: w.created_at,
      sets: (w.workout_sets ?? []).map((s: any) => ({
        exercise_name: s.exercises?.name ?? 'Exercise',
        weight: s.weight,
        reps: s.reps,
        unit: s.unit,
      })),
      hasPR: (w.workout_sets ?? []).some((s: any) => prSetIds.has(s.id)),
      likeCount: (w.likes ?? []).length,
      likedByMe: (w.likes ?? []).some((l: any) => l.user_id === userId),
      commentCount: (w.comments ?? []).length,
    };
  });
}
