-- Multi-image posts. photo_url stays as-is for existing rows/back-compat;
-- new posts write photo_urls and readers fall back to photo_url when it's null.
alter table workouts add column if not exists photo_urls text[];
