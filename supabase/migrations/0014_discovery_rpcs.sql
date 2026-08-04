-- Runs as invoker (default) so the existing follows/users RLS still governs
-- visibility -- this ranks by who the caller is actually allowed to see,
-- not a bypass-everything global ranking.
create or replace function get_suggested_users(viewer_id uuid, result_limit integer default 10)
returns table (id uuid, display_name text, avatar_url text, follower_count bigint)
language sql
stable
security invoker
as $$
  select u.id, u.display_name, u.avatar_url, count(f2.follower_id) as follower_count
  from users u
  left join follows f2 on f2.followee_id = u.id
  where u.id <> viewer_id
    and not exists (select 1 from follows f where f.follower_id = viewer_id and f.followee_id = u.id)
  group by u.id, u.display_name, u.avatar_url
  order by follower_count desc, u.id
  limit result_limit;
$$;

-- Same visibility caveat: workout_sets_select_visible restricts the
-- underlying join to the caller's own + followed workouts, so this is
-- "trending among lifters you follow," not a global leaderboard.
create or replace function get_trending_exercises(result_limit integer default 10)
returns table (id uuid, name text, log_count bigint)
language sql
stable
security invoker
as $$
  select e.id, e.name, count(*) as log_count
  from workout_sets ws
  join exercises e on e.id = ws.exercise_id
  join workouts w on w.id = ws.workout_id
  where w.created_at > now() - interval '7 days'
  group by e.id, e.name
  order by log_count desc
  limit result_limit;
$$;
