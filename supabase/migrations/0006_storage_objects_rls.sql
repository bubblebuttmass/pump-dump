-- Public buckets serve reads via the public URL endpoint, which bypasses
-- RLS entirely -- a SELECT policy here isn't needed for that and only
-- adds a way to list/enumerate every file in the bucket. Writes still
-- need explicit RLS policies on storage.objects, which were never added
-- when the buckets were created, so every upload failed with
-- "new row violates row-level security policy".
create policy "avatars_insert_own" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars_update_own" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "workout_photos_insert_own" on storage.objects for insert to authenticated
  with check (bucket_id = 'workout-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "workout_photos_update_own" on storage.objects for update to authenticated
  using (bucket_id = 'workout-photos' and (storage.foldername(name))[1] = auth.uid()::text);
