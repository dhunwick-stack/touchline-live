create table if not exists team_access_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  email text not null,
  organization_name text,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  approved_team_id uuid references teams(id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists team_access_requests_status_idx
  on team_access_requests(status, created_at desc);

create index if not exists team_access_requests_user_id_idx
  on team_access_requests(user_id);
