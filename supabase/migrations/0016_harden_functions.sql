-- Fix mutable search_path on every plpgsql/sql function (advisor:
-- function_search_path_mutable) -- without a pinned search_path, a caller
-- could get a function to resolve unqualified table/function names against
-- a schema they control instead of the intended one. Most critical for the
-- SECURITY DEFINER triggers, which run with elevated privilege.
alter function notify_on_like() set search_path = public;
alter function notify_on_comment() set search_path = public;
alter function notify_on_follow() set search_path = public;
alter function set_follow_status() set search_path = public;
alter function unfollow_on_block() set search_path = public;
alter function get_user_streak(uuid) set search_path = public;
alter function get_suggested_users(uuid, integer) set search_path = public;
alter function get_trending_exercises(integer) set search_path = public;

-- These SECURITY DEFINER functions are trigger-only plumbing (they read
-- NEW/OLD, which only exist in a trigger context) -- calling them directly
-- via PostgREST RPC just errors out today, but Postgres still exposes
-- EXECUTE to anon/authenticated by default. Revoke it so they're only ever
-- reachable the intended way: fired by their trigger.
revoke execute on function notify_on_like() from public, anon, authenticated;
revoke execute on function notify_on_comment() from public, anon, authenticated;
revoke execute on function notify_on_follow() from public, anon, authenticated;
revoke execute on function unfollow_on_block() from public, anon, authenticated;
