-- Wrap auth.uid()/auth.role() in (select ...) so Postgres evaluates them
-- once per query instead of once per row (Supabase advisor: auth_rls_initplan).
drop policy "users_select_all" on users;
drop policy "users_insert_self" on users;
drop policy "users_update_self" on users;
create policy "users_select_all" on users for select using ((select auth.role()) = 'authenticated');
create policy "users_insert_self" on users for insert with check ((select auth.uid()) = id);
create policy "users_update_self" on users for update using ((select auth.uid()) = id);

drop policy "follows_select_all" on follows;
drop policy "follows_insert_self" on follows;
drop policy "follows_delete_self" on follows;
create policy "follows_select_all" on follows for select using ((select auth.role()) = 'authenticated');
create policy "follows_insert_self" on follows for insert with check ((select auth.uid()) = follower_id);
create policy "follows_delete_self" on follows for delete using ((select auth.uid()) = follower_id);

drop policy "exercises_select_all" on exercises;
drop policy "exercises_insert_self" on exercises;
create policy "exercises_select_all" on exercises for select using ((select auth.role()) = 'authenticated');
create policy "exercises_insert_self" on exercises for insert with check ((select auth.uid()) = created_by or created_by is null);

drop policy "workouts_select_own_or_followed" on workouts;
drop policy "workouts_insert_self" on workouts;
drop policy "workouts_update_self" on workouts;
drop policy "workouts_delete_self" on workouts;
create policy "workouts_select_own_or_followed" on workouts for select using (
  (select auth.uid()) = user_id
  or exists (select 1 from follows f where f.follower_id = (select auth.uid()) and f.followee_id = workouts.user_id)
);
create policy "workouts_insert_self" on workouts for insert with check ((select auth.uid()) = user_id);
create policy "workouts_update_self" on workouts for update using ((select auth.uid()) = user_id);
create policy "workouts_delete_self" on workouts for delete using ((select auth.uid()) = user_id);

drop policy "workout_sets_select_visible" on workout_sets;
drop policy "workout_sets_insert_owner" on workout_sets;
create policy "workout_sets_select_visible" on workout_sets for select using (
  exists (
    select 1 from workouts w
    where w.id = workout_sets.workout_id
      and (w.user_id = (select auth.uid()) or exists (select 1 from follows f where f.follower_id = (select auth.uid()) and f.followee_id = w.user_id))
  )
);
create policy "workout_sets_insert_owner" on workout_sets for insert with check (
  exists (select 1 from workouts w where w.id = workout_id and w.user_id = (select auth.uid()))
);

drop policy "prs_select_own_or_followed" on personal_records;
drop policy "prs_insert_self" on personal_records;
create policy "prs_select_own_or_followed" on personal_records for select using (
  (select auth.uid()) = user_id
  or exists (select 1 from follows f where f.follower_id = (select auth.uid()) and f.followee_id = personal_records.user_id)
);
create policy "prs_insert_self" on personal_records for insert with check ((select auth.uid()) = user_id);

drop policy "likes_select_visible" on likes;
drop policy "likes_insert_self" on likes;
drop policy "likes_delete_self" on likes;
create policy "likes_select_visible" on likes for select using (
  exists (
    select 1 from workouts w
    where w.id = likes.workout_id
      and (w.user_id = (select auth.uid()) or exists (select 1 from follows f where f.follower_id = (select auth.uid()) and f.followee_id = w.user_id))
  )
);
create policy "likes_insert_self" on likes for insert with check ((select auth.uid()) = user_id);
create policy "likes_delete_self" on likes for delete using ((select auth.uid()) = user_id);

drop policy "comments_select_visible" on comments;
drop policy "comments_insert_self" on comments;
drop policy "comments_delete_self" on comments;
create policy "comments_select_visible" on comments for select using (
  exists (
    select 1 from workouts w
    where w.id = comments.workout_id
      and (w.user_id = (select auth.uid()) or exists (select 1 from follows f where f.follower_id = (select auth.uid()) and f.followee_id = w.user_id))
  )
);
create policy "comments_insert_self" on comments for insert with check ((select auth.uid()) = user_id);
create policy "comments_delete_self" on comments for delete using ((select auth.uid()) = user_id);

-- Missing FK indexes flagged by advisor.
create index if not exists idx_comments_user_id on comments(user_id);
create index if not exists idx_exercises_created_by on exercises(created_by);
create index if not exists idx_personal_records_exercise_id on personal_records(exercise_id);
create index if not exists idx_workout_sets_exercise_id on workout_sets(exercise_id);
