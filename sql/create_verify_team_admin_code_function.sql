create or replace function verify_team_admin_code(target_team_id uuid, entered_code text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  matched_team_id uuid;
  current_user_id uuid;
begin
  current_user_id := auth.uid();

  if current_user_id is null then
    return false;
  end if;

  select id
    into matched_team_id
  from teams
  where id = target_team_id
    and admin_code is not null
    and btrim(admin_code) = btrim(entered_code)
  limit 1;

  if matched_team_id is null then
    return false;
  end if;

  insert into team_users (team_id, user_id, role)
  values (matched_team_id, current_user_id, 'team_admin')
  on conflict (team_id, user_id)
  do update set role = excluded.role;

  return true;
end;
$$;

grant execute on function verify_team_admin_code(uuid, text) to authenticated;
