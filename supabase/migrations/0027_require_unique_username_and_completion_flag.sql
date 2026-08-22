-- Onboarding could be abandoned mid-flow (backgrounded/killed while a slow
-- avatar upload was in progress) and index.tsx's routing only ever checked
-- "is there a session", not "did they finish setting up a profile" -- so
-- the user would land straight in the feed with the auto-generated
-- placeholder display_name/no avatar and never get routed back. Track
-- completion explicitly instead of inferring it from field contents.
alter table users add column if not exists onboarding_completed_at timestamptz;

-- Backfill: anyone who already has both a real (non-placeholder) display
-- name and an avatar clearly did finish setting up their profile already,
-- even though this column didn't exist yet -- don't force them through
-- onboarding again.
update users
set onboarding_completed_at = created_at
where onboarding_completed_at is null
  and avatar_url is not null
  and display_name <> split_part(email, '@', 1);

-- Usernames must be unique (case-insensitive, so "JohnDoe" and "johndoe"
-- can't both exist).
create unique index if not exists users_display_name_lower_unique on users (lower(display_name));

-- The signup trigger's placeholder display_name (email local-part) now has
-- to be collision-safe against the unique index above -- two people can
-- share an email local-part (john@gmail.com vs john@yahoo.com), which
-- would otherwise fail the INSERT and break account creation entirely.
-- Appending part of the new user's id keeps it unique without needing to
-- query for a free name at signup time.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email, display_name)
  values (new.id, new.email, split_part(new.email, '@', 1) || '_' || substr(new.id::text, 1, 8));
  return new;
end;
$$;

revoke execute on function public.handle_new_auth_user() from anon, authenticated, public;
