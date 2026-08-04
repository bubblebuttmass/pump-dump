-- users_select_all lets any authenticated user SELECT any row in public.users
-- (needed for public profile browsing), but RLS filters rows, not columns --
-- so it was also handing out every user's email address to every other user.
-- The app never reads this column (it gets its own email from the auth
-- session), so there's no legitimate client use to preserve.
--
-- A column-level REVOKE alone has no effect here: Postgres column privileges
-- don't subtract from an existing whole-table GRANT SELECT, and Supabase
-- grants SELECT ON ALL TABLES to anon/authenticated by default. The
-- whole-table SELECT has to be revoked and re-granted scoped to the
-- public-safe columns only.
revoke select on public.users from anon, authenticated;
grant select (
  id, display_name, avatar_url, bio, traits, gym, favorite_lift,
  years_lifting, is_private, created_at, username_changed_at
) on public.users to anon, authenticated;
