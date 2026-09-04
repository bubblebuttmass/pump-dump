-- 0026's backfill only caught users whose display_name/avatar already
-- looked customized. Blanket-clear anyone still left over -- accounts that
-- existed before the onboarding gate went live shouldn't be forced through
-- it retroactively just because the heuristic didn't recognize them.
update users
set onboarding_completed_at = coalesce(onboarding_completed_at, created_at)
where onboarding_completed_at is null;
