-- Return type gained columns (gym, favorite_lift), so the old signature must
-- be dropped before recreating -- Postgres won't let CREATE OR REPLACE change
-- the OUT-parameter shape of an existing function.
drop function if exists get_suggested_users(uuid, integer);

create function get_suggested_users(viewer_id uuid, result_limit integer default 10)
returns table (id uuid, display_name text, avatar_url text, gym text, favorite_lift text, follower_count bigint)
language sql
stable
security invoker
set search_path = public
as $$
  select u.id, u.display_name, u.avatar_url, u.gym, u.favorite_lift, count(f2.follower_id) as follower_count
  from users u
  left join follows f2 on f2.followee_id = u.id and f2.status = 'accepted'
  where u.id <> viewer_id
    and not exists (select 1 from follows f where f.follower_id = viewer_id and f.followee_id = u.id)
  group by u.id, u.display_name, u.avatar_url, u.gym, u.favorite_lift
  order by follower_count desc, u.id
  limit result_limit;
$$;
