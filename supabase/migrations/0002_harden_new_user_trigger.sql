-- Lock down the auth.users trigger function per Supabase security advisor:
-- fix mutable search_path (schema-injection risk on a SECURITY DEFINER
-- function) and revoke direct RPC execution (trigger functions aren't
-- meant to be called outside trigger context).
alter function public.handle_new_auth_user() set search_path = public;
revoke execute on function public.handle_new_auth_user() from anon, authenticated, public;
