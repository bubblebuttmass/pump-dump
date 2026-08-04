import { supabase } from './supabase';

export interface SuggestedUser {
  id: string;
  display_name: string;
  avatar_url: string | null;
  gym: string | null;
  favoriteLift: string | null;
  followerCount: number;
}

export interface TrendingExercise {
  id: string;
  name: string;
  logCount: number;
}

export async function getSuggestedUsers(viewerId: string, limit = 10): Promise<SuggestedUser[]> {
  const { data, error } = await supabase.rpc('get_suggested_users', { viewer_id: viewerId, result_limit: limit });
  if (error) throw error;
  return (data ?? []).map((u: any) => ({
    id: u.id,
    display_name: u.display_name,
    avatar_url: u.avatar_url,
    gym: u.gym,
    favoriteLift: u.favorite_lift,
    followerCount: u.follower_count,
  }));
}

export async function getTrendingExercises(limit = 10): Promise<TrendingExercise[]> {
  const { data, error } = await supabase.rpc('get_trending_exercises', { result_limit: limit });
  if (error) throw error;
  return (data ?? []).map((e: any) => ({ id: e.id, name: e.name, logCount: e.log_count }));
}
