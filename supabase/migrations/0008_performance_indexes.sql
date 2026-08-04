-- Performance indexes for hot query paths.
-- follows PK is (follower_id, followee_id) -- covers lookups by follower_id,
-- but getFollowers() filters by followee_id alone, needing its own index.
create index if not exists idx_follows_followee on follows(followee_id);

-- Feed/profile ordering and per-user lookups.
create index if not exists idx_workouts_user_id on workouts(user_id);
create index if not exists idx_workouts_created_at on workouts(created_at desc);

-- Workout detail / RLS lookups by workout.
create index if not exists idx_workout_sets_workout_id on workout_sets(workout_id);

-- Personal record lookups: best-per-exercise and PR-badge joins.
create index if not exists idx_personal_records_user_exercise
  on personal_records(user_id, exercise_id, estimated_1rm desc);
create index if not exists idx_personal_records_workout_set_id
  on personal_records(workout_set_id);

-- Like/comment counts and RLS checks by workout.
create index if not exists idx_likes_workout_id on likes(workout_id);
create index if not exists idx_comments_workout_id_created_at
  on comments(workout_id, created_at);

-- Fuzzy exercise/user name search (ilike '%query%' can't use a plain btree).
create extension if not exists pg_trgm;
create index if not exists idx_exercises_name_trgm
  on exercises using gin (name gin_trgm_ops);
create index if not exists idx_users_display_name_trgm
  on users using gin (display_name gin_trgm_ops);
