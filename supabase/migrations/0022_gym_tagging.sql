-- Self-hosted gym directory: grows organically as users tag gyms on posts.
-- No external Places API, no per-request cost, no new third-party data
-- sharing -- the tradeoff is it starts empty rather than pre-loaded with
-- every real gym on day one.
create table public.gyms (
  id uuid primary key default extensions.uuid_generate_v4(),
  name text not null,
  lat double precision not null,
  lng double precision not null,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Bounding-box pre-filter for nearby_gyms below -- a plain btree index on
-- (lat, lng) is enough at this scale; not pulling in PostGIS for a feature
-- that just needs "gyms within a few miles," not real geospatial queries.
create index idx_gyms_lat_lng on public.gyms (lat, lng);

alter table public.gyms enable row level security;

-- Gym names/locations aren't sensitive (they're public venues, not user
-- locations) -- readable by anyone authenticated so the picker/feed can
-- resolve names without a per-row ownership check.
create policy gyms_select_all on public.gyms
for select
using ((select auth.role()) = 'authenticated');

create policy gyms_insert_self on public.gyms
for insert
with check ((select auth.uid()) = created_by);

-- Haversine distance in SQL -- good enough at "gyms near me" city-scale
-- without adding PostGIS. Bounding box first (cheap, uses the index) then
-- exact distance filter on the much smaller candidate set.
create or replace function public.nearby_gyms(p_lat double precision, p_lng double precision, p_radius_meters double precision default 1500)
returns table (id uuid, name text, lat double precision, lng double precision, distance_meters double precision)
language sql
stable
set search_path = public
as $$
  with candidates as (
    select g.id, g.name, g.lat, g.lng
    from public.gyms g
    where g.lat between p_lat - (p_radius_meters / 111000.0) and p_lat + (p_radius_meters / 111000.0)
      and g.lng between p_lng - (p_radius_meters / (111000.0 * cos(radians(p_lat)))) and p_lng + (p_radius_meters / (111000.0 * cos(radians(p_lat))))
  )
  select c.id, c.name, c.lat, c.lng,
    6371000 * acos(least(1.0, greatest(-1.0,
      sin(radians(p_lat)) * sin(radians(c.lat)) +
      cos(radians(p_lat)) * cos(radians(c.lat)) * cos(radians(c.lng - p_lng))
    ))) as distance_meters
  from candidates c
  where 6371000 * acos(least(1.0, greatest(-1.0,
      sin(radians(p_lat)) * sin(radians(c.lat)) +
      cos(radians(p_lat)) * cos(radians(c.lat)) * cos(radians(c.lng - p_lng))
    ))) <= p_radius_meters
  order by distance_meters asc
  limit 20;
$$;

grant execute on function public.nearby_gyms(double precision, double precision, double precision) to authenticated;

-- Optional per-post gym tag. SET NULL on delete so removing a gym (not
-- currently exposed in the app, but future-proofing) doesn't cascade into
-- deleting people's posts.
alter table public.workouts add column gym_id uuid references public.gyms(id) on delete set null;
create index idx_workouts_gym_id on public.workouts (gym_id);

-- created_by/created_at aren't needed by any client query (the picker and
-- feed only ever need id/name/lat/lng) -- excluding created_by keeps "who
-- first tagged this venue" from being queryable by other users.
revoke select on public.gyms from anon, authenticated;
grant select (id, name, lat, lng) on public.gyms to anon, authenticated;
