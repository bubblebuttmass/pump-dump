-- 0023 baked the push-webhook shared secret directly into this function's
-- source, which meant it also landed in plaintext in the migration file and
-- in git history. Move it to Supabase Vault instead: the actual secret value
-- is never written to a migration or committed anywhere -- it's inserted
-- once via `select vault.create_secret(...)` run directly against the
-- project, and this function just looks it up by name at call time.
create or replace function public.trigger_push_on_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  webhook_secret text;
begin
  select decrypted_secret into webhook_secret
  from vault.decrypted_secrets
  where name = 'push_webhook_secret';

  if webhook_secret is null then
    raise log 'push_webhook_secret not found in Vault; skipping push for notification %', new.id;
    return new;
  end if;

  perform net.http_post(
    url := 'https://stxezuegwdytwfkrsawa.supabase.co/functions/v1/send-push',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-webhook-secret', webhook_secret),
    body := jsonb_build_object('notification_id', new.id)
  );
  return new;
end;
$$;
