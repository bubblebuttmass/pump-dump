import { supabase } from './supabase';

export type NotificationType = 'like' | 'comment' | 'follow';

export interface AppNotification {
  id: string;
  type: NotificationType;
  actorId: string;
  actorName: string;
  actorAvatar: string | null;
  workoutId: string | null;
  read: boolean;
  createdAt: string;
}

export interface NotificationPage {
  items: AppNotification[];
  nextCursor: string | null;
}

const PAGE_SIZE = 20;

export async function getNotifications(userId: string, cursor?: string, limit = PAGE_SIZE): Promise<NotificationPage> {
  let query = supabase
    .from('notifications')
    .select('id, type, actor_id, workout_id, read, created_at, users:actor_id ( display_name, avatar_url )')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (cursor) query = query.lt('created_at', cursor);

  const { data, error } = await query;
  if (error) throw error;

  const items = (data ?? []).map((n: any) => ({
    id: n.id,
    type: n.type,
    actorId: n.actor_id,
    actorName: n.users?.display_name ?? 'Unknown',
    actorAvatar: n.users?.avatar_url ?? null,
    workoutId: n.workout_id,
    read: n.read,
    createdAt: n.created_at,
  }));
  const nextCursor = items.length === limit ? items[items.length - 1].createdAt : null;
  return { items, nextCursor };
}

export async function getUnreadCount(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('read', false);
  if (error) throw error;
  return count ?? 0;
}

export async function markAllRead(userId: string): Promise<void> {
  const { error } = await supabase.from('notifications').update({ read: true }).eq('user_id', userId).eq('read', false);
  if (error) throw error;
}
