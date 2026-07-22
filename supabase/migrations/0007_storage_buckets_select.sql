-- storage.buckets has RLS enabled with zero policies by default, which
-- means the Storage API can't read bucket config (size limits, mime
-- types) when processing an upload -- surfaced to clients as the same
-- "new row violates row-level security policy" error as an objects-table
-- rejection, even though the objects INSERT policy itself is correct.
create policy "public_buckets_select_all" on storage.buckets for select using (public = true);
