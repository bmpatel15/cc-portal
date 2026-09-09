-- cc-portal: atomic claiming for the notification queue.
--
-- Apply with `supabase db push`, or paste into the Supabase SQL editor.
-- Safe to re-run: every statement is guarded, matching 0001's house style.

/* -------------------------------------------------------------------------- */
/* Lease                                                                      */
/* -------------------------------------------------------------------------- */

-- dispatchPending used to select rows and then send them with nothing in
-- between. queueAndDeliver inserts a row as `pending` and delivers it inline, so
-- a cron tick landing in that window read the same row and sent it a second
-- time: two confirmation emails to the requestor, two Telegram messages to the
-- team.
--
-- A lease rather than a lock or a `sending` status. It expires, so a dispatcher
-- that dies mid-send needs no sweeper to recover -- the row simply becomes
-- claimable again. A new status value would also have meant
-- `alter type ... add value`, which Postgres will not let you *use* in the
-- transaction that adds it, and every documented way of applying these files
-- wraps them in one.
alter table public.notification_log add column if not exists claimed_at timestamptz;

comment on column public.notification_log.claimed_at is
  'When a dispatcher took this row. A lease, not a lock: it expires so a crashed send retries.';

/* -------------------------------------------------------------------------- */
/* Atomic claim                                                               */
/* -------------------------------------------------------------------------- */

-- One function for both callers. The cron passes no ids and takes the oldest
-- p_limit rows; queueAndDeliver passes the ids it just inserted. Both have to go
-- through here, because they race each other rather than only themselves.
--
-- `attempts` is incremented here, in SQL, instead of being written back from a
-- value the caller read earlier: concurrent attempts used to lose an increment,
-- which quietly weakened MAX_ATTEMPTS. Counting on *claim* also means a process
-- that dies mid-send burns an attempt, which is what stops a message that
-- reliably crashes the dispatcher from being retried forever.
--
-- 0001's notification_log_pending_idx already matches this status filter
-- exactly, so no new index: claimed_at is filtered on the heap, which is right
-- while the queue is this small.
--
-- security definer because only the service role ever calls it; execute is
-- revoked from everyone else below, matching is_staff/is_admin in 0002.
create or replace function public.claim_notifications(
  p_limit int default 25,
  p_max_attempts int default 5,
  p_lease interval default interval '5 minutes',
  p_ids uuid[] default null
)
returns setof public.notification_log
language sql
volatile
security definer
set search_path = public
as $$
  update public.notification_log as n
  set claimed_at = now(),
      attempts = n.attempts + 1
  from (
    select id
    from public.notification_log
    where status in ('pending', 'failed')
      and attempts < p_max_attempts
      and (claimed_at is null or claimed_at < now() - p_lease)
      and (p_ids is null or id = any (p_ids))
    order by created_at
    limit p_limit
    -- The whole point: a concurrent dispatcher passes over rows that are being
    -- claimed instead of blocking on them and then sending them again.
    for update skip locked
  ) as candidate
  where n.id = candidate.id
  returning n.*;
$$;

-- `create or replace` is only idempotent for an unchanged signature. If the
-- argument list ever changes, drop the old function explicitly first.
revoke all on function public.claim_notifications(int, int, interval, uuid[]) from public;
grant execute on function public.claim_notifications(int, int, interval, uuid[]) to service_role;
