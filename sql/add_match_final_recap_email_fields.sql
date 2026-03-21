alter table matches
  add column if not exists final_recap_emailed_at timestamptz,
  add column if not exists final_recap_email_error text;
