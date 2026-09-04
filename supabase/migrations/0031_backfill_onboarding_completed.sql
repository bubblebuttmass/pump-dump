-- The 2026-08-22 grandfather pass covered every user that existed at the
-- time, but onboarding.tsx never actually wrote onboarding_completed_at
-- when a user finished onboarding (fixed client-side alongside this) --
-- so any real signup since then who DID finish onboarding still reads as
-- incomplete. Same detection heuristic as the original migration, updated
-- for the trigger's current default pattern (email prefix + '_' + 8 chars
-- of the user id, added by require_unique_username_and_completion_flag):
-- if display_name no longer matches that auto-assigned default, onboarding
-- was actually completed.
update users
set onboarding_completed_at = created_at
where onboarding_completed_at is null
  and display_name is distinct from (split_part(email, '@', 1) || '_' || substr(id::text, 1, 8));
