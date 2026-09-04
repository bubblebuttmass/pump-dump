-- fix_users_email_column_leak locked public.users' client-facing SELECT down
-- to an explicit column allowlist. onboarding_completed_at was added after
-- that (0026) and never added to the allowlist, so the client's own read of
-- its own onboarding status 403'd -- silently defeating the onboarding gate
-- (auth.tsx's query would error, and the gate fails open on error).
grant select (onboarding_completed_at) on public.users to anon, authenticated;
