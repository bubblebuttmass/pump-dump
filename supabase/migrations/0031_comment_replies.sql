-- Comment replies: nullable self-reference, null = top-level comment.
alter table comments add column if not exists parent_comment_id uuid references comments(id) on delete cascade;
create index if not exists idx_comments_parent_id on comments(parent_comment_id) where parent_comment_id is not null;

-- Widen the notification type list for reply-specific notifications.
alter table notifications drop constraint if exists notifications_type_check;
alter table notifications add constraint notifications_type_check check (type in ('like', 'comment', 'follow', 'comment_reply'));

-- Replying to someone's comment notifies that person specifically, in
-- addition to the post-owner notification notify_on_comment already sends
-- for every comment (top-level or reply, unchanged). Skipped when the
-- reply's target is the replier themselves, or is the same person already
-- notified as post owner, so a reply never produces two identical-looking
-- notifications to the same person.
create or replace function notify_on_comment_reply()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  parent_author uuid;
  post_owner uuid;
begin
  if new.parent_comment_id is null then
    return new;
  end if;
  select user_id into parent_author from comments where id = new.parent_comment_id;
  select user_id into post_owner from workouts where id = new.workout_id;
  if parent_author is not null and parent_author <> new.user_id and parent_author <> post_owner then
    insert into notifications (user_id, actor_id, type, workout_id)
    values (parent_author, new.user_id, 'comment_reply', new.workout_id);
  end if;
  return new;
end;
$$;

revoke execute on function notify_on_comment_reply() from anon, authenticated, public;

create trigger on_comment_reply_insert after insert on comments for each row execute procedure notify_on_comment_reply();
