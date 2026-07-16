import { supabase } from './supabase';
import { getFeed, FeedPost } from './feed';

export interface PRSummary {
  exercise_name: string;
  weight: number;
  reps: number;
  estimated_1rm: number;
}

export interface ProfileSummary {
  display_name: string;
  avatar_url: string | null;
  bio: string | null;
  followerCount: number;
  followingCount: number;
  prList: PRSummary[];
  recentWorkouts: FeedPost[];
}

export async function getOwnProfile(userId: string): Promise<ProfileSummary> {
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('display_name, avatar_url, bio')
    .eq('id', userId)
    .single();
  if (userError) throw userError;

  const { count: followerCount } = await supabase
    .from('follows')
    .select('*', { count: 'exact', head: true })
    .eq('followee_id', userId);

  const { count: followingCount } = await supabase
    .from('follows')
    .select('*', { count: 'exact', head: true })
    .eq('follower_id', userId);

  const { data: prs, error: prError } = await supabase
    .from('personal_records')
    .select('weight, reps, estimated_1rm, exercises ( name )')
    .eq('user_id', userId)
    .order('estimated_1rm', { ascending: false });
  if (prError) throw prError;

  const bestPerExercise = new Map<string, PRSummary>();
  for (const p of prs as any[]) {
    const name = p.exercises?.name ?? 'Exercise';
    if (!bestPerExercise.has(name)) {
      bestPerExercise.set(name, { exercise_name: name, weight: p.weight, reps: p.reps, estimated_1rm: p.estimated_1rm });
    }
  }

  const allWorkouts = await getFeed(userId);
  const recentWorkouts = allWorkouts.filter((w) => w.user_id === userId);

  return {
    display_name: user.display_name,
    avatar_url: user.avatar_url,
    bio: user.bio,
    followerCount: followerCount ?? 0,
    followingCount: followingCount ?? 0,
    prList: Array.from(bestPerExercise.values()),
    recentWorkouts,
  };
}
