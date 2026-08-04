alter table users add column if not exists is_private boolean not null default false;

alter table follows add column if not exists status text not null default 'accepted' check (status in ('pending', 'accepted'));

-- The client never gets to choose status directly: this trigger stamps it
-- based on the target's current privacy setting, so a modified client can't
-- insert 'accepted' to bypass a private account's approval requirement.
create or replace function set_follow_status()
returns trigger language plpgsql as $$
declare
  target_private boolean;
begin
  select is_private into target_private from users where id = new.followee_id;
  new.status := case when target_private then 'pending' else 'accepted' end;
  return new;
end;
$$;
create trigger before_follow_insert before insert on follows for each row execute procedure set_follow_status();

-- Followee needs to accept/decline pending requests -- prior policies only
-- let the follower manage their own row.
create policy "follows_update_followee" on follows for update
  using ((select auth.uid()) = followee_id) with check ((select auth.uid()) = followee_id);
create policy "follows_delete_followee" on follows for delete
  using ((select auth.uid()) = followee_id);

-- Content-visibility policies checked `exists (select 1 from follows ...)`
-- with no status filter -- a pending (unapproved) follow row would satisfy
-- that and leak a private account's posts before the request was accepted.
-- Re-scope every one of them to accepted-only follows.
drop policy "workouts_select_own_or_followed" on workouts;
create policy "workouts_select_own_or_followed" on workouts for select using (
  (select auth.uid()) = user_id
  or exists (
    select 1 from follows f
    where f.follower_id = (select auth.uid()) and f.followee_id = workouts.user_id and f.status = 'accepted'
  )
);

drop policy "workout_sets_select_visible" on workout_sets;
create policy "workout_sets_select_visible" on workout_sets for select using (
  exists (
    select 1 from workouts w
    where w.id = workout_sets.workout_id
      and (
        w.user_id = (select auth.uid())
        or exists (
          select 1 from follows f
          where f.follower_id = (select auth.uid()) and f.followee_id = w.user_id and f.status = 'accepted'
        )
      )
  )
);

drop policy "prs_select_own_or_followed" on personal_records;
create policy "prs_select_own_or_followed" on personal_records for select using (
  (select auth.uid()) = user_id
  or exists (
    select 1 from follows f
    where f.follower_id = (select auth.uid()) and f.followee_id = personal_records.user_id and f.status = 'accepted'
  )
);

drop policy "likes_select_visible" on likes;
create policy "likes_select_visible" on likes for select using (
  exists (
    select 1 from workouts w
    where w.id = likes.workout_id
      and (
        w.user_id = (select auth.uid())
        or exists (
          select 1 from follows f
          where f.follower_id = (select auth.uid()) and f.followee_id = w.user_id and f.status = 'accepted'
        )
      )
  )
);

drop policy "comments_select_visible" on comments;
create policy "comments_select_visible" on comments for select using (
  exists (
    select 1 from workouts w
    where w.id = comments.workout_id
      and (
        w.user_id = (select auth.uid())
        or exists (
          select 1 from follows f
          where f.follower_id = (select auth.uid()) and f.followee_id = w.user_id and f.status = 'accepted'
        )
      )
  )
);

create table blocks (
  blocker_id uuid not null references users(id) on delete cascade,
  blocked_id uuid not null references users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
alter table blocks enable row level security;
create policy "blocks_select_own" on blocks for select using ((select auth.uid()) = blocker_id);
create policy "blocks_insert_self" on blocks for insert with check ((select auth.uid()) = blocker_id);
create policy "blocks_delete_self" on blocks for delete using ((select auth.uid()) = blocker_id);
create index idx_blocks_blocked_id on blocks(blocked_id);

-- Blocking severs any existing follow relationship in either direction.
-- SECURITY DEFINER because the blocker doesn't own the reverse-direction
-- follow row (blocked_id -> blocker_id) under the normal follows RLS.
create or replace function unfollow_on_block()
returns trigger language plpgsql security definer as $$
begin
  delete from follows
  where (follower_id = new.blocker_id and followee_id = new.blocked_id)
     or (follower_id = new.blocked_id and followee_id = new.blocker_id);
  return new;
end;
$$;
create trigger after_block_insert after insert on blocks for each row execute procedure unfollow_on_block();

-- Can't follow someone who has blocked you, or whom you've blocked.
drop policy "follows_insert_self" on follows;
create policy "follows_insert_self" on follows for insert with check (
  (select auth.uid()) = follower_id
  and not exists (
    select 1 from blocks b
    where (b.blocker_id = followee_id and b.blocked_id = (select auth.uid()))
       or (b.blocker_id = (select auth.uid()) and b.blocked_id = followee_id)
  )
);

create table mutes (
  muter_id uuid not null references users(id) on delete cascade,
  muted_id uuid not null references users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (muter_id, muted_id),
  check (muter_id <> muted_id)
);
alter table mutes enable row level security;
create policy "mutes_select_own" on mutes for select using ((select auth.uid()) = muter_id);
create policy "mutes_insert_self" on mutes for insert with check ((select auth.uid()) = muter_id);
create policy "mutes_delete_self" on mutes for delete using ((select auth.uid()) = muter_id);

create table reports (
  id uuid primary key default uuid_generate_v4(),
  reporter_id uuid not null references users(id) on delete cascade,
  reported_user_id uuid references users(id) on delete cascade,
  workout_id uuid references workouts(id) on delete cascade,
  reason text not null,
  created_at timestamptz not null default now(),
  check (reported_user_id is not null or workout_id is not null)
);
alter table reports enable row level security;
create policy "reports_insert_self" on reports for insert with check ((select auth.uid()) = reporter_id);
-- No select policy for regular users: reports are write-only from the client.
-- Reviewing them is an admin/service-role concern -- out of scope here.

-- Blocked pairs can no longer like or comment on each other's posts, closing
-- the gap where insert wasn't visibility-gated even though select already was.
drop policy "comments_insert_self" on comments;
create policy "comments_insert_self" on comments for insert with check (
  (select auth.uid()) = user_id
  and not exists (
    select 1 from workouts w
    join blocks b on (b.blocker_id = w.user_id and b.blocked_id = (select auth.uid()))
                   or (b.blocker_id = (select auth.uid()) and b.blocked_id = w.user_id)
    where w.id = workout_id
  )
);

drop policy "likes_insert_self" on likes;
create policy "likes_insert_self" on likes for insert with check (
  (select auth.uid()) = user_id
  and not exists (
    select 1 from workouts w
    join blocks b on (b.blocker_id = w.user_id and b.blocked_id = (select auth.uid()))
                   or (b.blocker_id = (select auth.uid()) and b.blocked_id = w.user_id)
    where w.id = workout_id
  )
);
