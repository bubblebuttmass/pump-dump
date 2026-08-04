import { supabase } from './supabase';
import { getMutedUserIds } from './moderation';

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
  photos: string[];
  created_at: string;
  sets: FeedSet[];
  hasPR: boolean;
  likeCount: number;
  likedByMe: boolean;
  bookmarkedByMe: boolean;
  commentCount: number;
  latestComment: { display_name: string; body: string } | null;
}

export interface FeedPage {
  posts: FeedPost[];
  nextCursor: string | null;
}

export const FEED_PAGE_SIZE = 15;

// Exported for reuse by lib/bookmarks.ts, which needs the identical shape
// for a second entry point (workouts joined through the bookmarks table
// instead of queried directly).
export const WORKOUT_SELECT = `id, user_id, title, caption, photo_url, photo_urls, created_at,
   users:user_id ( display_name, avatar_url ),
   workout_sets ( weight, reps, unit, exercises ( name ), id, personal_records ( workout_set_id ) ),
   likes ( user_id ),
   bookmarks ( user_id ),
   comments ( id, body, created_at, users:user_id ( display_name ) )`;

export function mapWorkoutRow(w: any, viewerId: string): FeedPost {
  const prSetIds = new Set(
    (w.workout_sets ?? []).flatMap((s: any) => (s.personal_records ?? []).map((p: any) => p.workout_set_id))
  );
  const comments = w.comments ?? [];
  const latest = comments.length > 0
    ? comments.reduce((a: any, b: any) => (new Date(b.created_at) > new Date(a.created_at) ? b : a))
    : null;
  return {
    id: w.id,
    user_id: w.user_id,
    display_name: w.users?.display_name ?? 'Unknown',
    avatar_url: w.users?.avatar_url ?? null,
    title: w.title,
    caption: w.caption ?? null,
    photos: w.photo_urls?.length > 0 ? w.photo_urls : w.photo_url ? [w.photo_url] : [],
    created_at: w.created_at,
    sets: (w.workout_sets ?? []).map((s: any) => ({
      exercise_name: s.exercises?.name ?? 'Exercise',
      weight: s.weight,
      reps: s.reps,
      unit: s.unit,
    })),
    hasPR: (w.workout_sets ?? []).some((s: any) => prSetIds.has(s.id)),
    likeCount: (w.likes ?? []).length,
    likedByMe: (w.likes ?? []).some((l: any) => l.user_id === viewerId),
    bookmarkedByMe: (w.bookmarks ?? []).some((b: any) => b.user_id === viewerId),
    commentCount: comments.length,
    latestComment: latest ? { display_name: latest.users?.display_name ?? 'Unknown', body: latest.body } : null,
  };
}

// Keyset pagination on created_at: pass the previous page's nextCursor to
// fetch the next page. Cheaper than OFFSET at scale since it seeks straight
// to the cursor row via idx_workouts_created_at instead of re-scanning and
// discarding every row before the offset.
export async function getFeed(
  userId: string,
  cursor?: string,
  limit: number = FEED_PAGE_SIZE
): Promise<FeedPage> {
  const mutedIds = await getMutedUserIds(userId);

  let query = supabase
    .from('workouts')
    .select(WORKOUT_SELECT)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (cursor) query = query.lt('created_at', cursor);
  if (mutedIds.length > 0) query = query.not('user_id', 'in', `(${mutedIds.join(',')})`);

  const { data: workouts, error } = await query;
  if (error) throw error;

  const posts = (workouts ?? []).map((w: any) => mapWorkoutRow(w, userId));
  const nextCursor = posts.length === limit ? posts[posts.length - 1].created_at : null;
  return { posts, nextCursor };
}

// Direct per-user query for a profile's own posts, independent of the
// visibility-limited/capped main feed query above.
export async function getUserPosts(
  userId: string,
  viewerId: string,
  cursor?: string,
  limit: number = FEED_PAGE_SIZE
): Promise<FeedPage> {
  let query = supabase
    .from('workouts')
    .select(WORKOUT_SELECT)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (cursor) query = query.lt('created_at', cursor);

  const { data: workouts, error } = await query;
  if (error) throw error;

  const posts = (workouts ?? []).map((w: any) => mapWorkoutRow(w, viewerId));
  const nextCursor = posts.length === limit ? posts[posts.length - 1].created_at : null;
  return { posts, nextCursor };
}
