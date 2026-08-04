alter table users add column if not exists username_changed_at timestamptz;

-- Enforced server-side (not just hidden in the client UI) so it can't be
-- bypassed by hitting the REST API directly. Only fires when display_name
-- actually changes -- saving bio/gym/traits etc. is unaffected.
create or replace function enforce_username_cooldown()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.display_name is distinct from old.display_name then
    if old.username_changed_at is not null and now() - old.username_changed_at < interval '60 days' then
      raise exception 'You can change your username again in % day(s)',
        ceil(extract(epoch from ((old.username_changed_at + interval '60 days') - now())) / 86400)::int;
    end if;
    new.username_changed_at := now();
  end if;
  return new;
end;
$$;

create trigger before_users_update_username_cooldown
  before update on users for each row execute procedure enforce_username_cooldown();
