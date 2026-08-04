import { supabase } from './supabase';
import { getUserPosts, FeedPost } from './feed';
import { computeBadges, Badge } from './badges';

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
  gym: string | null;
  favoriteLift: string | null;
  yearsLifting: number | null;
  isPrivate: boolean;
  usernameChangedAt: string | null;
  traits: string[];
  followerCount: number;
  followingCount: number;
  prList: PRSummary[];
  recentWorkouts: FeedPost[];
  recentWorkoutsNextCursor: string | null;
  workoutCount: number;
  streak: number;
  badges: Badge[];
}

export async function getProfile(userId: string, viewerId: string): Promise<ProfileSummary> {
  // None of these seven queries depend on each other's results, so they were
  // pure serial round-trip waterfall before -- firing them together cuts
  // this screen's load time to whichever single query is slowest, instead
  // of the sum of all seven.
  const [
    { data: user, error: userError },
    { count: followerCount },
    { count: followingCount },
    { count: workoutCount },
    { data: prs, error: prError },
    { data: streakResult },
    { posts: recentWorkouts, nextCursor: recentWorkoutsNextCursor },
  ] = await Promise.all([
    supabase
      .from('users')
      .select('display_name, avatar_url, bio, traits, gym, favorite_lift, years_lifting, is_private, username_changed_at')
      .eq('id', userId)
      .single(),
    supabase.from('follows').select('*', { count: 'exact', head: true }).eq('followee_id', userId).eq('status', 'accepted'),
    supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', userId).eq('status', 'accepted'),
    supabase.from('workouts').select('*', { count: 'exact', head: true }).eq('user_id', userId),
    supabase
      .from('personal_records')
      .select('weight, reps, estimated_1rm, exercises ( name )')
      .eq('user_id', userId)
      .order('estimated_1rm', { ascending: false }),
    supabase.rpc('get_user_streak', { target_user_id: userId }),
    // Queried directly by user_id (idx_workouts_user_id) instead of reusing
    // the capped main feed query + client-side filter -- that older approach
    // silently dropped a user's own older posts once the global feed page
    // filled up with other people's more recent ones.
    getUserPosts(userId, viewerId),
  ]);
  if (userError) throw userError;
  if (prError) throw prError;

  const bestPerExercise = new Map<string, PRSummary>();
  for (const p of prs as any[]) {
    const name = p.exercises?.name ?? 'Exercise';
    if (!bestPerExercise.has(name)) {
      bestPerExercise.set(name, { exercise_name: name, weight: p.weight, reps: p.reps, estimated_1rm: p.estimated_1rm });
    }
  }

  const streak = streakResult ?? 0;
  const prCount = bestPerExercise.size;

  return {
    display_name: user.display_name,
    avatar_url: user.avatar_url,
    bio: user.bio,
    gym: (user as any).gym ?? null,
    favoriteLift: (user as any).favorite_lift ?? null,
    yearsLifting: (user as any).years_lifting ?? null,
    isPrivate: (user as any).is_private ?? false,
    usernameChangedAt: (user as any).username_changed_at ?? null,
    traits: user.traits ?? [],
    followerCount: followerCount ?? 0,
    followingCount: followingCount ?? 0,
    prList: Array.from(bestPerExercise.values()),
    recentWorkouts,
    recentWorkoutsNextCursor,
    workoutCount: workoutCount ?? 0,
    streak,
    badges: computeBadges({ workoutCount: workoutCount ?? 0, prCount, streak }),
  };
}

export interface BadgeStats {
  workoutCount: number;
  prCount: number;
  streak: number;
}

// Lightweight sibling to getProfile's badge inputs -- used to snapshot
// "before" and "after" state around a save so the caller can diff which
// badges are newly earned, without paying for the full profile fetch
// (recent posts, follower counts, etc.) twice.
export async function getBadgeStats(userId: string): Promise<BadgeStats> {
  const [{ count: workoutCount }, { data: prExerciseRows, error: prError }, { data: streakResult }] = await Promise.all([
    supabase.from('workouts').select('*', { count: 'exact', head: true }).eq('user_id', userId),
    supabase.from('personal_records').select('exercise_id').eq('user_id', userId),
    supabase.rpc('get_user_streak', { target_user_id: userId }),
  ]);
  if (prError) throw prError;
  const prCount = new Set((prExerciseRows ?? []).map((r) => r.exercise_id)).size;

  return { workoutCount: workoutCount ?? 0, prCount, streak: streakResult ?? 0 };
}

export interface WeeklyRecap {
  workoutsThisWeek: number;
  prsThisWeek: number;
}

export async function getWeeklyRecap(userId: string): Promise<WeeklyRecap> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [{ count: workoutsThisWeek }, { count: prsThisWeek }] = await Promise.all([
    supabase.from('workouts').select('*', { count: 'exact', head: true }).eq('user_id', userId).gte('created_at', sevenDaysAgo),
    supabase.from('personal_records').select('*', { count: 'exact', head: true }).eq('user_id', userId).gte('achieved_at', sevenDaysAgo),
  ]);

  return { workoutsThisWeek: workoutsThisWeek ?? 0, prsThisWeek: prsThisWeek ?? 0 };
}

const USERNAME_COOLDOWN_DAYS = 60;

// Client-side mirror of the enforce_username_cooldown trigger's logic --
// used to disable the field and show a countdown before the user even
// tries to save, rather than letting them hit the DB's rejection cold.
export function getUsernameCooldownDaysRemaining(usernameChangedAt: string | null): number {
  if (!usernameChangedAt) return 0;
  const elapsedMs = Date.now() - new Date(usernameChangedAt).getTime();
  const remainingMs = USERNAME_COOLDOWN_DAYS * 24 * 60 * 60 * 1000 - elapsedMs;
  return remainingMs > 0 ? Math.ceil(remainingMs / (24 * 60 * 60 * 1000)) : 0;
}

export interface ProfileUpdate {
  displayName: string;
  bio: string;
  gym: string;
  favoriteLift: string;
  yearsLifting: string;
  isPrivate: boolean;
  traits: string[];
  avatarUrl?: string;
}

// Settings' private-account toggle only needs to change one column -- routing
// it through updateProfile would mean fetching the rest of the profile first
// just to re-send fields that aren't changing, trading one round trip for two.
export async function updatePrivacy(userId: string, isPrivate: boolean): Promise<void> {
  const { error } = await supabase.from('users').update({ is_private: isPrivate }).eq('id', userId);
  if (error) throw error;
}

export async function updateProfile(userId: string, update: ProfileUpdate): Promise<void> {
  const parsedYears = parseInt(update.yearsLifting, 10);
  const { error } = await supabase
    .from('users')
    .update({
      display_name: update.displayName.trim(),
      bio: update.bio.trim().length > 0 ? update.bio.trim() : null,
      gym: update.gym.trim().length > 0 ? update.gym.trim() : null,
      favorite_lift: update.favoriteLift.trim().length > 0 ? update.favoriteLift.trim() : null,
      years_lifting: Number.isFinite(parsedYears) ? parsedYears : null,
      is_private: update.isPrivate,
      traits: update.traits,
      ...(update.avatarUrl ? { avatar_url: update.avatarUrl } : {}),
    })
    .eq('id', userId);
  if (error) throw error;
}
