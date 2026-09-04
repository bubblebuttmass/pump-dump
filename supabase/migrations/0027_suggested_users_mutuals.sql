-- "Suggested Lifters" just ranked every user on the platform by global
-- follower count, which is really "everyone who has the app you don't
-- follow yet" -- not a personalized suggestion. Rank by mutual connections
-- instead (people followed by people you follow), same as most social
-- apps' "suggested for you". Still falls back to the old popular-users
-- ordering to pad out the list for accounts with few/no follows yet
-- (otherwise a brand new user would see an empty section).
--
-- Return shape gained mutual_count, so the old signature must be dropped
-- first -- CREATE OR REPLACE can't change an existing function's
-- OUT-parameter shape.
drop function if exists get_suggested_users(uuid, integer);

create function get_suggested_users(viewer_id uuid, result_limit integer default 10)
returns table (
  id uuid,
  display_name text,
  avatar_url text,
  gym text,
  favorite_lift text,
  follower_count bigint,
  mutual_count bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  with excluded as (
    select followee_id as id from follows where follower_id = viewer_id
    union
    select viewer_id
  ),
  candidates as (
    select
      u.id, u.display_name, u.avatar_url, u.gym, u.favorite_lift,
      count(f.follower_id) as follower_count,
      count(f.follower_id) filter (
        where f.follower_id in (
          select followee_id from follows where follower_id = viewer_id and status = 'accepted'
        )
      ) as mutual_count
    from users u
    left join follows f on f.followee_id = u.id and f.status = 'accepted'
    where u.id not in (select id from excluded)
    group by u.id, u.display_name, u.avatar_url, u.gym, u.favorite_lift
  ),
  top_mutuals as (
    select * from candidates
    where mutual_count > 0
    order by mutual_count desc, follower_count desc, id
    limit result_limit
  ),
  fallback as (
    select * from candidates
    where mutual_count = 0
    order by follower_count desc, id
    limit greatest(result_limit - (select count(*) from top_mutuals), 0)
  )
  select * from top_mutuals
  union all
  select * from fallback;
$$;
