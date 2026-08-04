create index if not exists idx_mutes_muted_id on mutes(muted_id);
create index if not exists idx_reports_reporter_id on reports(reporter_id);
create index if not exists idx_reports_reported_user_id on reports(reported_user_id);
create index if not exists idx_reports_workout_id on reports(workout_id);

-- follows_delete_self and follows_delete_followee were two permissive
-- policies covering the same DELETE action -- Postgres evaluates both on
-- every delete. Same effective permission (either party can remove the
-- row), so collapse into one.
drop policy "follows_delete_self" on follows;
drop policy "follows_delete_followee" on follows;
create policy "follows_delete_own_or_followee" on follows for delete using (
  (select auth.uid()) = follower_id or (select auth.uid()) = followee_id
);
