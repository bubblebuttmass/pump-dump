import { supabase } from './supabase';

export interface UserResult {
  id: string;
  display_name: string;
  avatar_url: string | null;
}

export type FollowStatus = 'none' | 'pending' | 'accepted';

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

export async function getFollowStatus(followerId: string, followeeId: string): Promise<FollowStatus> {
  const { data, error } = await supabase
    .from('follows')
    .select('status')
    .eq('follower_id', followerId)
    .eq('followee_id', followeeId)
    .maybeSingle();
  if (error) throw error;
  return (data?.status as FollowStatus) ?? 'none';
}

// Back-compat helper for call sites that only care about "actively following"
// (accepted), not whether a request is pending.
export async function isFollowing(followerId: string, followeeId: string): Promise<boolean> {
  return (await getFollowStatus(followerId, followeeId)) === 'accepted';
}

// Resulting status is server-decided (see the before_follow_insert trigger):
// 'accepted' immediately for public accounts, 'pending' for private ones.
export async function follow(followerId: string, followeeId: string): Promise<FollowStatus> {
  const { data, error } = await supabase
    .from('follows')
    .insert({ follower_id: followerId, followee_id: followeeId })
    .select('status')
    .single();
  if (error) throw error;
  return data.status as FollowStatus;
}

export async function unfollow(followerId: string, followeeId: string): Promise<void> {
  const { error } = await supabase
    .from('follows')
    .delete()
    .eq('follower_id', followerId)
    .eq('followee_id', followeeId);
  if (error) throw error;
}

export async function getFollowers(userId: string): Promise<UserResult[]> {
  const { data, error } = await supabase
    .from('follows')
    .select('users:follower_id ( id, display_name, avatar_url )')
    .eq('followee_id', userId)
    .eq('status', 'accepted');
  if (error) throw error;
  return (data ?? []).map((row: any) => row.users).filter(Boolean);
}

export async function getFollowing(userId: string): Promise<UserResult[]> {
  const { data, error } = await supabase
    .from('follows')
    .select('users:followee_id ( id, display_name, avatar_url )')
    .eq('follower_id', userId)
    .eq('status', 'accepted');
  if (error) throw error;
  return (data ?? []).map((row: any) => row.users).filter(Boolean);
}

export interface FollowRequest {
  followerId: string;
  display_name: string;
  avatar_url: string | null;
}

export async function getFollowRequests(userId: string): Promise<FollowRequest[]> {
  const { data, error } = await supabase
    .from('follows')
    .select('follower_id, users:follower_id ( display_name, avatar_url )')
    .eq('followee_id', userId)
    .eq('status', 'pending');
  if (error) throw error;
  return (data ?? []).map((row: any) => ({
    followerId: row.follower_id,
    display_name: row.users?.display_name ?? 'Unknown',
    avatar_url: row.users?.avatar_url ?? null,
  }));
}

export async function acceptFollowRequest(followerId: string, followeeId: string): Promise<void> {
  const { error } = await supabase
    .from('follows')
    .update({ status: 'accepted' })
    .eq('follower_id', followerId)
    .eq('followee_id', followeeId);
  if (error) throw error;
}

export async function declineFollowRequest(followerId: string, followeeId: string): Promise<void> {
  const { error } = await supabase
    .from('follows')
    .delete()
    .eq('follower_id', followerId)
    .eq('followee_id', followeeId);
  if (error) throw error;
}
