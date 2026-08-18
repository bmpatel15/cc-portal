-- cc-portal: logged time entries and the derived-duration view behind analytics.
--
-- Apply with `supabase db push`, or paste into the Supabase SQL editor.
-- Safe to re-run: every statement is guarded, matching 0001/0002's house style.

/* -------------------------------------------------------------------------- */
/* Logged time                                                                */
/* -------------------------------------------------------------------------- */

-- Nothing in 0001/0002 records effort, so analytics can only ever derive
-- *elapsed* time from the status history. This table is the other half: what
-- someone actually worked.
--
-- A table rather than an `hours` column on `requests` because more than one
-- person can work a single request, and attribution is the point — a column
-- would collapse that to a single anonymous number and lose the ability to
-- correct one person's entry without destroying the rest.
create table if not exists public.request_time_entries (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.requests (id) on delete cascade,

  -- Nullable so removing a staff account does not erase the hours they logged;
  -- the work still happened and should still count toward totals.
  staff_id uuid references public.profiles (id) on delete set null,

  hours numeric(6, 2) not null check (hours > 0 and hours <= 999),
  note text,

  -- The day the work happened, which is not necessarily the day it was entered.
  worked_on date not null default current_date,

  created_at timestamptz not null default now()
);

create index if not exists request_time_entries_request_id_idx
  on public.request_time_entries (request_id, created_at);

create index if not exists request_time_entries_staff_id_idx
  on public.request_time_entries (staff_id);

-- Analytics buckets logged hours by the day the work happened.
create index if not exists request_time_entries_worked_on_idx
  on public.request_time_entries (worked_on);

/* -------------------------------------------------------------------------- */
/* Row level security                                                         */
/* -------------------------------------------------------------------------- */

-- Defence in depth only, exactly as in 0002: the app reaches these tables with
-- the service role, which bypasses RLS. The authoritative checks live in
-- src/lib/requests/permissions.ts.
alter table public.request_time_entries enable row level security;

drop policy if exists "staff read time entries" on public.request_time_entries;
create policy "staff read time entries" on public.request_time_entries
  for select to authenticated
  using (public.is_staff());

drop policy if exists "staff log own time" on public.request_time_entries;
create policy "staff log own time" on public.request_time_entries
  for insert to authenticated
  with check (public.is_staff() and staff_id = auth.uid());

drop policy if exists "author or admin removes time entry" on public.request_time_entries;
create policy "author or admin removes time entry" on public.request_time_entries
  for delete to authenticated
  using (public.is_admin() or staff_id = auth.uid());

/* -------------------------------------------------------------------------- */
/* Derived durations                                                          */
/* -------------------------------------------------------------------------- */

-- One row per request, carrying every duration analytics needs. This lives in
-- SQL rather than TypeScript because the span arithmetic below has two traps
-- that are silent when got wrong, and a view is testable straight from the SQL
-- editor.
--
-- Trap 1 — terminal statuses must not accrue time. Taking `lead()` over the
-- history and falling back to `now()` for the final span credits a *finished*
-- request with ever-growing "time in complete": a request completed last month
-- would report a month of work. A span that ends in complete/cancelled and has
-- no successor is clamped to zero.
--
-- Trap 2 — transitions are not monotonic. `canChangeStatus` permits skipping
-- stages, and admins may move backwards or reopen a closed request, so a
-- request can enter `complete` more than once and statuses can repeat. Hence
-- `sum()` over all spans per status rather than assuming one span each, and
-- `min()` for milestones so turnaround measures to *first* completion.
create or replace view public.request_durations
with (security_invoker = true)
as
with spans as (
  select
    h.request_id,
    h.to_status as status,
    h.created_at as entered_at,
    -- id breaks ties so two transitions in the same microsecond stay ordered.
    lead(h.created_at) over (
      partition by h.request_id order by h.created_at, h.id
    ) as next_at
  from public.request_status_history h
),
bounded as (
  select
    request_id,
    status,
    entered_at,
    case
      when next_at is not null then next_at
      when status in ('complete', 'cancelled') then entered_at  -- trap 1
      else now()
    end as left_at
  from spans
),
per_status as (
  select
    request_id,
    coalesce(sum(extract(epoch from (left_at - entered_at)))
      filter (where status = 'pending'), 0) as pending_seconds,
    coalesce(sum(extract(epoch from (left_at - entered_at)))
      filter (where status = 'in_progress'), 0) as in_progress_seconds,
    coalesce(sum(extract(epoch from (left_at - entered_at)))
      filter (where status = 'review'), 0) as review_seconds
  from bounded
  group by request_id
),
milestones as (
  select
    request_id,
    min(created_at) filter (where to_status = 'in_progress') as first_pickup_at,
    min(created_at) filter (where to_status = 'complete') as first_complete_at,
    min(created_at) filter (where to_status = 'cancelled') as first_cancelled_at,
    count(*) as transition_count
  from public.request_status_history
  group by request_id
),
logged as (
  select request_id, sum(hours) as logged_hours, count(*) as time_entry_count
  from public.request_time_entries
  group by request_id
)
select
  r.id,
  r.created_at,
  r.event_datetime,
  r.team,
  r.department,
  r.status,
  r.assigned_to,
  r.event_name,

  -- Carried through so the crew-size proxies (photographerCount and friends)
  -- come from the same paged read as everything else, rather than a second
  -- unpaged query that would truncate at 1000 rows.
  r.details,

  m.first_pickup_at,
  m.first_complete_at,
  m.first_cancelled_at,
  coalesce(m.transition_count, 0) as transition_count,

  coalesce(p.pending_seconds, 0) as pending_seconds,
  coalesce(p.in_progress_seconds, 0) as in_progress_seconds,
  coalesce(p.review_seconds, 0) as review_seconds,

  -- Queue latency: submission to the first time anyone picked it up.
  case
    when m.first_pickup_at is not null
      then extract(epoch from (m.first_pickup_at - r.created_at))
  end as time_to_pickup_seconds,

  -- Turnaround: submission to *first* completion. Null while still open, and
  -- null for cancelled requests, which never completed and would otherwise
  -- flatter the average.
  case
    when m.first_complete_at is not null
      then extract(epoch from (m.first_complete_at - r.created_at))
  end as turnaround_seconds,

  -- Notice given by the requester. Negative when a request arrives after the
  -- event it refers to, which is worth seeing rather than hiding.
  extract(epoch from (r.event_datetime - r.created_at)) as lead_time_seconds,

  l.logged_hours,
  coalesce(l.time_entry_count, 0) as time_entry_count
from public.requests r
left join per_status p on p.request_id = r.id
left join milestones m on m.request_id = r.id
left join logged l on l.request_id = r.id;
