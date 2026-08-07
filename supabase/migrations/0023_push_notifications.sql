create extension if not exists pg_net;

create table public.push_tokens (
  id uuid primary key default extensions.uuid_generate_v4(),
  user_id uuid not null references public.users(id) on delete cascade,
  token text not null unique,
  platform text not null check (platform in ('ios', 'android')),
  created_at timestamptz not null default now()
);

create index idx_push_tokens_user_id on public.push_tokens (user_id);

alter table public.push_tokens enable row level security;

create policy push_tokens_select_own on public.push_tokens
for select using ((select auth.uid()) = user_id);

create policy push_tokens_insert_own on public.push_tokens
for insert with check ((select auth.uid()) = user_id);

create policy push_tokens_update_own on public.push_tokens
for update using ((select auth.uid()) = user_id);

create policy push_tokens_delete_own on public.push_tokens
for delete using ((select auth.uid()) = user_id);

-- Fires the send-push edge function after every notification row is
-- created (likes/comments/follows already insert into notifications via
-- the existing notify_on_* triggers -- this doesn't touch those, just
-- reacts to their output). Uses a shared secret header rather than
-- verify_jwt, since the caller here is Postgres itself, not an end user.
create or replace function public.trigger_push_on_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform net.http_post(
    url := 'https://stxezuegwdytwfkrsawa.supabase.co/functions/v1/send-push',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-webhook-secret', '21d7bf69a7540252588692650fffb457413327eff9896d2a9968825b2ce8abd8'),
    body := jsonb_build_object('notification_id', new.id)
  );
  return new;
end;
$$;

create trigger on_notification_created_push
after insert on public.notifications
for each row execute function public.trigger_push_on_notification();
