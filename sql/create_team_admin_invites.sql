create table if not exists team_admin_invites (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  email text not null,
  role text not null default 'team_admin',
  invite_token text not null unique,
  invited_by_user_id uuid not null references auth.users(id) on delete cascade,
  accepted_user_id uuid references auth.users(id) on delete set null,
  accepted_at timestamptz,
  expires_at timestamptz not null default (now() + interval '14 days'),
  created_at timestamptz not null default now()
);

create index if not exists team_admin_invites_team_id_idx
  on team_admin_invites(team_id, created_at desc);

create index if not exists team_admin_invites_email_idx
  on team_admin_invites(lower(email));
