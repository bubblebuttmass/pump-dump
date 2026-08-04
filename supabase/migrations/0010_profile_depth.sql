alter table users add column if not exists gym text;
alter table users add column if not exists favorite_lift text;
alter table users add column if not exists years_lifting integer;

-- Consecutive-day posting streak, computed server-side in one query.
-- Runs SECURITY INVOKER (default) so it respects workouts_select_own_or_followed --
-- a caller only sees their own streak accurately, or a followed user's, matching
-- the same visibility rule already applied to Recent Posts.
create or replace function get_user_streak(target_user_id uuid)
returns integer
language plpgsql
stable
security invoker
as $$
declare
  result integer := 0;
  expected date;
  d date;
  is_first boolean := true;
begin
  for d in
    select distinct date_trunc('day', created_at)::date
    from workouts
    where user_id = target_user_id
    order by 1 desc
  loop
    if is_first then
      if d = current_date or d = current_date - 1 then
        expected := d;
        result := 1;
        is_first := false;
      else
        exit;
      end if;
    elsif d = expected - 1 then
      result := result + 1;
      expected := d;
    else
      exit;
    end if;
  end loop;
  return result;
end;
$$;
