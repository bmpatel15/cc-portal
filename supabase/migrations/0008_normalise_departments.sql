-- cc-portal: fold case and spacing variants of a department onto one spelling.
--
-- Apply with `supabase db push`, or paste into the Supabase SQL editor.
-- Safe to re-run: every statement is guarded, matching 0001's house style.

/* -------------------------------------------------------------------------- */
/* Backup                                                                     */
/* -------------------------------------------------------------------------- */

-- `department` was free text until the form became a dropdown, so the same team
-- arrived spelled several ways -- "IT", "it", "I.T ", "Satsang  Pravrutti" --
-- and the analytics department filter treats each as its own department.
--
-- This rewrites requestor-supplied data, so the previous value is kept. Without
-- it the only way back from a bad fold is a database restore.
create table if not exists public.department_cleanup_backup (
  request_id uuid primary key references public.requests (id) on delete cascade,
  department text not null,
  backed_up_at timestamptz not null default now()
);

alter table public.department_cleanup_backup enable row level security;

comment on table public.department_cleanup_backup is
  'Pre-normalisation department values from 0008. Drop once the fold is confirmed good.';

/* -------------------------------------------------------------------------- */
/* Normalise                                                                  */
/* -------------------------------------------------------------------------- */

-- Deliberately conservative: this only collapses rows that differ from a
-- canonical name by letter case or whitespace. It does NOT guess that "Satsang"
-- means "Satsang Pravrutti", or that "Tech" means "IT" -- those are judgements
-- about what a person meant, and getting one wrong silently reassigns their
-- request to another department. Anything it does not recognise is left exactly
-- as it is, for a human to decide with the report at the bottom of this file.
--
-- The backup insert is a data-modifying CTE, so it runs even though the final
-- statement does not read from it, and it sees the pre-update snapshot.
with canonical (name) as (
  values ('Satsang Pravrutti'), ('Services'), ('CA/PA'), ('Facilities'), ('Network'), ('IT')
),
matched as (
  select
    r.id,
    r.department as previous,
    c.name as corrected
  from public.requests r
  join canonical c
    on lower(regexp_replace(btrim(coalesce(r.department, '')), '\s+', ' ', 'g')) = lower(c.name)
  where r.department is distinct from c.name
),
saved as (
  insert into public.department_cleanup_backup (request_id, department)
  select id, previous from matched
  on conflict (request_id) do nothing
  returning request_id
)
update public.requests r
   set department = m.corrected
  from matched m
 where r.id = m.id;

/* -------------------------------------------------------------------------- */
/* What is left                                                               */
/* -------------------------------------------------------------------------- */

-- Run this afterwards. Every row it returns is a department this migration
-- would not touch, and needs someone who knows the teams to say what it means:
--
--   select department, count(*) as requests
--     from public.requests
--    where department not in
--          ('Satsang Pravrutti','Services','CA/PA','Facilities','Network','IT')
--    group by department
--    order by requests desc;
--
-- To undo the fold:
--
--   update public.requests r
--      set department = b.department
--     from public.department_cleanup_backup b
--    where r.id = b.request_id;
