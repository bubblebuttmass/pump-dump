import { supabase } from './supabase';
import { FeedPage, FEED_PAGE_SIZE, WORKOUT_SELECT, mapWorkoutRow } from './feed';

export async function toggleBookmark(userId: string, workoutId: string, currentlyBookmarked: boolean): Promise<void> {
  if (currentlyBookmarked) {
    const { error } = await supabase.from('bookmarks').delete().eq('user_id', userId).eq('workout_id', workoutId);
    if (error) throw error;
  } else {
    const { error } = await supabase.from('bookmarks').insert({ user_id: userId, workout_id: workoutId });
    if (error) throw error;
  }
}

// Paginated by save time (bookmarks.created_at), not post time -- most
// recently saved first, independent of when the underlying post was made.
export async function getBookmarkedPosts(
  userId: string,
  cursor?: string,
  limit: number = FEED_PAGE_SIZE
): Promise<FeedPage> {
  let markQuery = supabase
    .from('bookmarks')
    .select('workout_id, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (cursor) markQuery = markQuery.lt('created_at', cursor);

  const { data: marks, error: markError } = await markQuery;
  if (markError) throw markError;
  if (!marks || marks.length === 0) return { posts: [], nextCursor: null };

  const ids = marks.map((m) => m.workout_id);
  const { data: workouts, error } = await supabase.from('workouts').select(WORKOUT_SELECT).in('id', ids);
  if (error) throw error;

  const byId = new Map((workouts ?? []).map((w: any) => [w.id, w]));
  const posts = ids
    .map((id) => byId.get(id))
    .filter(Boolean)
    .map((w: any) => mapWorkoutRow(w, userId));

  const nextCursor = marks.length === limit ? marks[marks.length - 1].created_at : null;
  return { posts, nextCursor };
}
