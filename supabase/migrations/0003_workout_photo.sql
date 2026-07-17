alter table workouts add column photo_url text;

insert into storage.buckets (id, name, public) values ('workout-photos', 'workout-photos', true)
on conflict (id) do nothing;
