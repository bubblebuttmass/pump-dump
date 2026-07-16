create extension if not exists "uuid-ossp";

create table users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text not null,
  avatar_url text,
  bio text,
  created_at timestamptz not null default now()
);

create table follows (
  follower_id uuid not null references users(id) on delete cascade,
  followee_id uuid not null references users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, followee_id),
  check (follower_id <> followee_id)
);

create table exercises (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  is_custom boolean not null default false,
  created_by uuid references users(id) on delete set null
);

create table workouts (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references users(id) on delete cascade,
  title text,
  notes text,
  started_at timestamptz not null default now(),
  duration_min integer,
  created_at timestamptz not null default now()
);

create table workout_sets (
  id uuid primary key default uuid_generate_v4(),
  workout_id uuid not null references workouts(id) on delete cascade,
  exercise_id uuid not null references exercises(id),
  set_order integer not null,
  weight numeric not null,
  reps integer not null,
  unit text not null default 'lb' check (unit in ('kg', 'lb'))
);

create table personal_records (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references users(id) on delete cascade,
  exercise_id uuid not null references exercises(id),
  weight numeric not null,
  reps integer not null,
  estimated_1rm numeric not null,
  workout_set_id uuid references workout_sets(id) on delete set null,
  achieved_at timestamptz not null default now()
);

create table likes (
  user_id uuid not null references users(id) on delete cascade,
  workout_id uuid not null references workouts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, workout_id)
);

create table comments (
  id uuid primary key default uuid_generate_v4(),
  workout_id uuid not null references workouts(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

alter table users enable row level security;
alter table follows enable row level security;
alter table exercises enable row level security;
alter table workouts enable row level security;
alter table workout_sets enable row level security;
alter table personal_records enable row level security;
alter table likes enable row level security;
alter table comments enable row level security;

create policy "users_select_all" on users for select using (auth.role() = 'authenticated');
create policy "users_insert_self" on users for insert with check (auth.uid() = id);
create policy "users_update_self" on users for update using (auth.uid() = id);

create policy "follows_select_all" on follows for select using (auth.role() = 'authenticated');
create policy "follows_insert_self" on follows for insert with check (auth.uid() = follower_id);
create policy "follows_delete_self" on follows for delete using (auth.uid() = follower_id);

create policy "exercises_select_all" on exercises for select using (auth.role() = 'authenticated');
create policy "exercises_insert_self" on exercises for insert with check (auth.uid() = created_by or created_by is null);

create policy "workouts_select_own_or_followed" on workouts for select using (
  auth.uid() = user_id
  or exists (select 1 from follows f where f.follower_id = auth.uid() and f.followee_id = workouts.user_id)
);
create policy "workouts_insert_self" on workouts for insert with check (auth.uid() = user_id);
create policy "workouts_update_self" on workouts for update using (auth.uid() = user_id);
create policy "workouts_delete_self" on workouts for delete using (auth.uid() = user_id);

create policy "workout_sets_select_visible" on workout_sets for select using (
  exists (
    select 1 from workouts w
    where w.id = workout_sets.workout_id
      and (w.user_id = auth.uid() or exists (select 1 from follows f where f.follower_id = auth.uid() and f.followee_id = w.user_id))
  )
);
create policy "workout_sets_insert_owner" on workout_sets for insert with check (
  exists (select 1 from workouts w where w.id = workout_id and w.user_id = auth.uid())
);

create policy "prs_select_own_or_followed" on personal_records for select using (
  auth.uid() = user_id
  or exists (select 1 from follows f where f.follower_id = auth.uid() and f.followee_id = personal_records.user_id)
);
create policy "prs_insert_self" on personal_records for insert with check (auth.uid() = user_id);

create policy "likes_select_visible" on likes for select using (
  exists (
    select 1 from workouts w
    where w.id = likes.workout_id
      and (w.user_id = auth.uid() or exists (select 1 from follows f where f.follower_id = auth.uid() and f.followee_id = w.user_id))
  )
);
create policy "likes_insert_self" on likes for insert with check (auth.uid() = user_id);
create policy "likes_delete_self" on likes for delete using (auth.uid() = user_id);

create policy "comments_select_visible" on comments for select using (
  exists (
    select 1 from workouts w
    where w.id = comments.workout_id
      and (w.user_id = auth.uid() or exists (select 1 from follows f where f.follower_id = auth.uid() and f.followee_id = w.user_id))
  )
);
create policy "comments_insert_self" on comments for insert with check (auth.uid() = user_id);
create policy "comments_delete_self" on comments for delete using (auth.uid() = user_id);

-- Auto-create a `users` row whenever a new auth user signs up.
create function public.handle_new_auth_user()
returns trigger as $$
begin
  insert into public.users (id, email, display_name)
  values (new.id, new.email, split_part(new.email, '@', 1));
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_auth_user();
