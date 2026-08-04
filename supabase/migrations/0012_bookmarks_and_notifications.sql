create table bookmarks (
  user_id uuid not null references users(id) on delete cascade,
  workout_id uuid not null references workouts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, workout_id)
);
alter table bookmarks enable row level security;
create policy "bookmarks_select_own" on bookmarks for select using ((select auth.uid()) = user_id);
create policy "bookmarks_insert_self" on bookmarks for insert with check ((select auth.uid()) = user_id);
create policy "bookmarks_delete_self" on bookmarks for delete using ((select auth.uid()) = user_id);
create index idx_bookmarks_user_created on bookmarks(user_id, created_at desc);

create table notifications (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references users(id) on delete cascade,
  actor_id uuid not null references users(id) on delete cascade,
  type text not null check (type in ('like', 'comment', 'follow')),
  workout_id uuid references workouts(id) on delete cascade,
  read boolean not null default false,
  created_at timestamptz not null default now()
);
alter table notifications enable row level security;
create policy "notifications_select_own" on notifications for select using ((select auth.uid()) = user_id);
create policy "notifications_update_own" on notifications for update using ((select auth.uid()) = user_id);
-- No insert policy for clients: rows are only ever created by the
-- SECURITY DEFINER trigger functions below, on the recipient's behalf.
create index idx_notifications_user_created on notifications(user_id, created_at desc);

create or replace function notify_on_like()
returns trigger language plpgsql security definer as $$
declare
  post_owner uuid;
begin
  select user_id into post_owner from workouts where id = new.workout_id;
  if post_owner is not null and post_owner <> new.user_id then
    insert into notifications (user_id, actor_id, type, workout_id)
    values (post_owner, new.user_id, 'like', new.workout_id);
  end if;
  return new;
end;
$$;
create trigger on_like_insert after insert on likes for each row execute procedure notify_on_like();

create or replace function notify_on_comment()
returns trigger language plpgsql security definer as $$
declare
  post_owner uuid;
begin
  select user_id into post_owner from workouts where id = new.workout_id;
  if post_owner is not null and post_owner <> new.user_id then
    insert into notifications (user_id, actor_id, type, workout_id)
    values (post_owner, new.user_id, 'comment', new.workout_id);
  end if;
  return new;
end;
$$;
create trigger on_comment_insert after insert on comments for each row execute procedure notify_on_comment();

create or replace function notify_on_follow()
returns trigger language plpgsql security definer as $$
begin
  insert into notifications (user_id, actor_id, type)
  values (new.followee_id, new.follower_id, 'follow');
  return new;
end;
$$;
create trigger on_follow_insert after insert on follows for each row execute procedure notify_on_follow();
