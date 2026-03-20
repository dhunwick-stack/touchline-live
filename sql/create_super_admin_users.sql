create table if not exists super_admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists super_admin_users_created_at_idx
  on super_admin_users(created_at desc);
