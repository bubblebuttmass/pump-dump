-- Security advisor: is_accepted_follower is SECURITY DEFINER and reachable
-- directly via /rest/v1/rpc/is_accepted_follower by anon and authenticated
-- alike, with p_follower/p_followee fully caller-controlled. The
-- follows_select_visible policy (0021) only ever calls it with the
-- caller's own auth.uid() as p_follower, but nothing enforced that at the
-- function level -- a direct RPC call could pass ANY two user ids and
-- enumerate accepted-follow relationships across the whole private social
-- graph, unauthenticated, regardless of whether either party consented to
-- that being visible.
--
-- Fix at the function itself (not just grants): only ever answer for
-- p_follower = the caller's own auth.uid(). That's already the only way
-- the policy ever calls it, so this changes nothing for legitimate use --
-- it just makes probing someone else's relationships return nothing
-- instead of a real answer, no matter how the function is invoked.
create or replace function public.is_accepted_follower(p_follower uuid, p_followee uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.follows f
    where f.follower_id = p_follower and f.followee_id = p_followee and f.status = 'accepted'
  )
  where p_follower = (select auth.uid());
$$;

-- Belt-and-suspenders: anon has no legitimate reason to call this at all
-- (the policy runs as `authenticated`, which still needs EXECUTE to
-- evaluate follows_select_visible -- that grant stays).
revoke execute on function public.is_accepted_follower(uuid, uuid) from public, anon;

-- trigger_push_on_notification is RETURNS TRIGGER -- Postgres already
-- rejects any attempt to call it outside trigger context ("trigger
-- functions can only be called as triggers"), so this is hygiene matching
-- the same pattern 0018 applied to the other trigger-only functions, not a
-- live exploit path.
revoke execute on function public.trigger_push_on_notification() from public, anon, authenticated;
