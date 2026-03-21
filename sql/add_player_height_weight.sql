alter table players
  add column if not exists height text,
  add column if not exists weight text;
