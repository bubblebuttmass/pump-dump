-- One level of threading: a comment can reply to another comment on the
-- same post. Replies-to-replies aren't modeled separately -- the client
-- flattens those into the same thread (see addComment/getComments in
-- src/lib/social.ts) rather than the schema enforcing arbitrary depth.
alter table comments add column if not exists parent_comment_id uuid references comments(id) on delete cascade;
create index if not exists idx_comments_parent_id on comments(parent_comment_id) where parent_comment_id is not null;

alter table notifications drop constraint if exists notifications_type_check;
alter table notifications add constraint notifications_type_check check (type in ('like', 'comment', 'follow', 'comment_reply'));

-- Separate from notify_on_comment (which already tells the *post* owner
-- about every comment, reply included) -- this additionally tells the
-- specific person being replied to, when that's someone other than the
-- post owner or the replier themselves.
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
