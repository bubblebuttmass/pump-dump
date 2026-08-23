-- Migration 0027 added onboarding_completed_at but missed that this table
-- doesn't use a whole-table SELECT grant -- migration 0020 revoked it and
-- replaced it with an explicit per-column grant list, so any column not on
-- that list is unreadable regardless of RLS. Every check of this column
-- has been failing with 403 (confirmed in production logs) since the moment
-- it shipped, which defeated the onboarding-completion gate entirely: the
-- client's fail-open handling for that error let every session through as
-- "complete" whether it actually was or not.
grant select (onboarding_completed_at) on public.users to anon, authenticated;
