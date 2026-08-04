import { supabase } from './supabase';
import { UserResult } from './social-graph';

export async function blockUser(blockerId: string, blockedId: string): Promise<void> {
  const { error } = await supabase.from('blocks').insert({ blocker_id: blockerId, blocked_id: blockedId });
  if (error) throw error;
}

export async function unblockUser(blockerId: string, blockedId: string): Promise<void> {
  const { error } = await supabase.from('blocks').delete().eq('blocker_id', blockerId).eq('blocked_id', blockedId);
  if (error) throw error;
}

export async function isBlocked(blockerId: string, blockedId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('blocks')
    .select('blocker_id')
    .eq('blocker_id', blockerId)
    .eq('blocked_id', blockedId)
    .maybeSingle();
  if (error) throw error;
  return !!data;
}

export async function getBlockedUsers(blockerId: string): Promise<UserResult[]> {
  const { data, error } = await supabase
    .from('blocks')
    .select('users:blocked_id ( id, display_name, avatar_url )')
    .eq('blocker_id', blockerId);
  if (error) throw error;
  return (data ?? []).map((row: any) => row.users).filter(Boolean);
}

export async function muteUser(muterId: string, mutedId: string): Promise<void> {
  const { error } = await supabase.from('mutes').insert({ muter_id: muterId, muted_id: mutedId });
  if (error) throw error;
}

export async function unmuteUser(muterId: string, mutedId: string): Promise<void> {
  const { error } = await supabase.from('mutes').delete().eq('muter_id', muterId).eq('muted_id', mutedId);
  if (error) throw error;
}

export async function isMuted(muterId: string, mutedId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('mutes')
    .select('muter_id')
    .eq('muter_id', muterId)
    .eq('muted_id', mutedId)
    .maybeSingle();
  if (error) throw error;
  return !!data;
}

export async function getMutedUserIds(muterId: string): Promise<string[]> {
  const { data, error } = await supabase.from('mutes').select('muted_id').eq('muter_id', muterId);
  if (error) throw error;
  return (data ?? []).map((m) => m.muted_id);
}

export interface ReportInput {
  reporterId: string;
  reportedUserId?: string;
  workoutId?: string;
  reason: string;
}

export async function reportContent(input: ReportInput): Promise<void> {
  const { error } = await supabase.from('reports').insert({
    reporter_id: input.reporterId,
    reported_user_id: input.reportedUserId ?? null,
    workout_id: input.workoutId ?? null,
    reason: input.reason,
  });
  if (error) throw error;
}
