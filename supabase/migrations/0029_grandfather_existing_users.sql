-- Migration 0027's backfill only marked an account onboarding-complete if
-- it already had both a real username and a photo -- correct for the new
-- "must have both" rule going forward, but it meant every pre-existing
-- account that never got around to setting a photo would be forced back
-- into onboarding on its next launch. That's a real behavior change for
-- people already using the app, not just a gate on new signups. Grandfather
-- every account that existed before this rule shipped so it only applies
-- to accounts created from here forward.
update users
set onboarding_completed_at = coalesce(onboarding_completed_at, created_at)
where onboarding_completed_at is null;
