alter table players
add column school_year text
check (
  school_year is null
  or school_year in (
    'Freshman',
    'Sophomore',
    'Junior',
    'Senior',
    'Graduate',
    'Postgrad'
  )
);
