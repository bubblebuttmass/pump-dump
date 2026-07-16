import { supabase } from './supabase';

export interface UserResult {
  id: string;
  display_name: string;
  avatar_url: string | null;
}

export async function searchUsers(query: string, excludeUserId: string): Promise<UserResult[]> {
  const { data, error } = await supabase
    .from('users')
    .select('id, display_name, avatar_url')
    .ilike('display_name', `%${query.trim()}%`)
    .neq('id', excludeUserId)
    .limit(30);
  if (error) throw error;
  return data;
}

export async function isFollowing(followerId: string, followeeId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('follows')
    .select('follower_id')
    .eq('follower_id', followerId)
    .eq('followee_id', followeeId)
    .maybeSingle();
  if (error) throw error;
  return !!data;
}

export async function follow(followerId: string, followeeId: string): Promise<void> {
  const { error } = await supabase.from('follows').insert({ follower_id: followerId, followee_id: followeeId });
  if (error) throw error;
}

export async function unfollow(followerId: string, followeeId: string): Promise<void> {
  const { error } = await supabase
    .from('follows')
    .delete()
    .eq('follower_id', followerId)
    .eq('followee_id', followeeId);
  if (error) throw error;
}
