-- cc-portal: bound how many upload URLs one caller can mint.
--
-- Apply with `supabase db push`, or paste into the Supabase SQL editor.
-- Safe to re-run: every statement is guarded, matching 0001's house style.

/* -------------------------------------------------------------------------- */
/* Upload rate limit                                                          */
/* -------------------------------------------------------------------------- */

-- /api/uploads/sign mints signed upload URLs with the service role and cannot
-- require a session: the request form is deliberately public, and requestors
-- have no accounts. Unthrottled, that is free file hosting for anyone who finds
-- the endpoint -- the bucket's 100MB limit caps a single object, not how many.
--
-- A fixed hourly window rather than a sliding one: the counter is a single row
-- per caller per hour, so it needs no history and no background trimming beyond
-- the sweep in the cron route.
create table if not exists public.upload_rate_limit (
  ip text not null,
  window_start timestamptz not null,
  count int not null default 0,
  primary key (ip, window_start)
);

-- Consistent with every other table here: the service role bypasses RLS and is
-- the only thing that touches this, so enabling it with no policy denies
-- everyone else by default.
alter table public.upload_rate_limit enable row level security;

-- One statement, so two requests arriving together cannot both read a stale
-- count and both decide they are under the cap. The insert either creates the
-- window or increments it, and returns the value the caller is judged on.
create or replace function public.record_upload_attempt(p_ip text)
returns int
language sql
volatile
security definer
set search_path = public
as $$
  insert into public.upload_rate_limit as existing (ip, window_start, count)
  values (p_ip, date_trunc('hour', now()), 1)
  on conflict (ip, window_start) do update
    set count = existing.count + 1
  returning existing.count;
$$;

-- security definer, so execute is granted only to the role that legitimately
-- calls it. Mirrors the is_staff/is_admin precedent in 0002.
revoke all on function public.record_upload_attempt(text) from public;
grant execute on function public.record_upload_attempt(text) to service_role;
