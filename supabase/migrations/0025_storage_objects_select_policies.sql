-- avatars/workout-photos are public buckets, so reads via the public URL
-- endpoint bypass storage.objects RLS entirely today -- these SELECT
-- policies don't change that on their own. They exist so that (a) any
-- authenticated read path that *does* go through the Storage API (signed
-- URLs, the dashboard, a future move to private buckets) is already
-- correctly scoped instead of wide open, and (b) the objects table isn't
-- sitting RLS-enabled-with-zero-select-policies, which the advisor flags.
--
-- Mirrors the same visibility already enforced on the users/workouts
-- tables: avatars follow public.users' "any authenticated user" rule,
-- workout-photos follow workouts_select_own_or_followed (own posts, or an
-- accepted follow of that post's owner).
create policy "avatars_select_authenticated" on storage.objects for select
  to authenticated
  using (bucket_id = 'avatars');

create policy "workout_photos_select_visible" on storage.objects for select
  to authenticated
  using (
    bucket_id = 'workout-photos'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or exists (
        select 1 from public.follows f
        where f.follower_id = (select auth.uid())
          and f.followee_id = ((storage.foldername(name))[1])::uuid
          and f.status = 'accepted'
      )
    )
  );
