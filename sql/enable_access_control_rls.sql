-- ---------------------------------------------------
-- SAFE FIRST-PASS RLS FOR ACCESS / AUTH TABLES
-- ---------------------------------------------------
-- Scope:
-- - super_admin_users
-- - team_access_requests
-- - team_users
--
-- This intentionally does NOT touch public content tables yet.
-- Apply only after:
-- - create_super_admin_users.sql
-- - create_team_access_requests.sql
-- - create_verify_team_admin_code_function.sql

-- ---------------------------------------------------
-- SUPER ADMINS
-- ---------------------------------------------------

alter table super_admin_users enable row level security;

drop policy if exists "super_admin_users_select_own" on super_admin_users;

create policy "super_admin_users_select_own"
  on super_admin_users
  for select
  to authenticated
  using (auth.uid() = user_id);

-- Intentionally no client-side insert/update/delete policies here.
-- Manage this table from SQL only for now.

-- ---------------------------------------------------
-- TEAM ACCESS REQUESTS
-- ---------------------------------------------------

alter table team_access_requests enable row level security;

drop policy if exists "team_access_requests_insert_signup" on team_access_requests;
drop policy if exists "team_access_requests_select_own" on team_access_requests;
drop policy if exists "team_access_requests_select_super_admin" on team_access_requests;
drop policy if exists "team_access_requests_update_super_admin" on team_access_requests;

-- Allow signup request intake from the browser.
-- Keeps current flow working even before email confirmation creates a session.
create policy "team_access_requests_insert_signup"
  on team_access_requests
  for insert
  to anon, authenticated
  with check (
    status = 'pending'
    and approved_team_id is null
    and approved_at is null
    and email <> ''
  );

-- Signed-in users can see their own requests.
create policy "team_access_requests_select_own"
  on team_access_requests
  for select
  to authenticated
  using (auth.uid() = user_id);

-- Super admins can review all requests.
create policy "team_access_requests_select_super_admin"
  on team_access_requests
  for select
  to authenticated
  using (
    exists (
      select 1
      from super_admin_users
      where super_admin_users.user_id = auth.uid()
    )
  );

-- Super admins can approve / reject requests.
create policy "team_access_requests_update_super_admin"
  on team_access_requests
  for update
  to authenticated
  using (
    exists (
      select 1
      from super_admin_users
      where super_admin_users.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from super_admin_users
      where super_admin_users.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------
-- TEAM USERS
-- ---------------------------------------------------

alter table team_users enable row level security;

drop policy if exists "team_users_select_own" on team_users;
drop policy if exists "team_users_select_super_admin" on team_users;
drop policy if exists "team_users_modify_super_admin" on team_users;

-- Regular users can read only their own memberships.
create policy "team_users_select_own"
  on team_users
  for select
  to authenticated
  using (auth.uid() = user_id);

-- Super admins can read all memberships.
create policy "team_users_select_super_admin"
  on team_users
  for select
  to authenticated
  using (
    exists (
      select 1
      from super_admin_users
      where super_admin_users.user_id = auth.uid()
    )
  );

-- Super admins can insert, update, and delete memberships from the app.
create policy "team_users_modify_super_admin"
  on team_users
  for all
  to authenticated
  using (
    exists (
      select 1
      from super_admin_users
      where super_admin_users.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from super_admin_users
      where super_admin_users.user_id = auth.uid()
    )
  );
