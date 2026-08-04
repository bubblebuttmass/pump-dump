-- follows_select_all let any authenticated user read any row -- meaning a
-- private account's follower/following list was visible to strangers, even
-- though their posts/comments/likes/PRs already correctly gate on accepted-
-- follow status via the same pattern used below.
--
-- A naive port of that pattern subquery's public.follows from inside its
-- own SELECT policy, which Postgres can't resolve (infinite recursion,
-- 42P17) since evaluating the subquery re-triggers the same policy on
-- itself. The accepted-follower check has to live in a SECURITY DEFINER
-- function instead -- it runs with elevated privilege and bypasses RLS
-- entirely, so it can check the table without re-entering this policy.
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
  );
$$;

grant execute on function public.is_accepted_follower(uuid, uuid) to authenticated;

drop policy if exists follows_select_all on public.follows;

create policy follows_select_visible on public.follows
for select
using (
  (select auth.uid()) = follower_id
  or (select auth.uid()) = followee_id
  or not exists (
    select 1 from public.users u where u.id = follows.followee_id and u.is_private
  )
  or public.is_accepted_follower((select auth.uid()), follows.followee_id)
);
