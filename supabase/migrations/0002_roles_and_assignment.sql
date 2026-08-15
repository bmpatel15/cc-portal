-- cc-portal: account activation, role helpers, and request assignment.
--
-- Apply with `supabase db push`, or paste into the Supabase SQL editor.
-- Safe to re-run: every statement is guarded, matching 0001's house style.

/* -------------------------------------------------------------------------- */
/* Account activation                                                         */
/* -------------------------------------------------------------------------- */

-- `handle_new_user` creates a profile for anyone who completes a magic link, so
-- a profile row alone was never proof of authorisation. New signups now land
-- inactive and wait for an admin.
--
-- Adding the column with default true backfills every existing profile as
-- active; flipping the default afterwards applies to new rows only. Re-running
-- is a no-op: `if not exists` skips the add, and setting the default is
-- idempotent.
alter table public.profiles add column if not exists is_active boolean not null default true;
alter table public.profiles alter column is_active set default false;

/* -------------------------------------------------------------------------- */
/* Role helpers                                                               */
/* -------------------------------------------------------------------------- */

-- `is_staff` is redefined rather than replaced so the policies written against
-- it in 0001 pick up the activation requirement without being rewritten.
create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and is_active and role in ('admin', 'staff')
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and is_active and role = 'admin'
  );
$$;

/* -------------------------------------------------------------------------- */
/* Assignment                                                                 */
/* -------------------------------------------------------------------------- */

-- `requests.assigned_to` already exists (0001); it just had no index and no
-- policy distinguishing the assignee from anyone else.
create index if not exists requests_assigned_to_idx on public.requests (assigned_to);

/* -------------------------------------------------------------------------- */
/* Row level security                                                         */
/* -------------------------------------------------------------------------- */

-- Defence in depth only. The dashboard reads and writes through the service
-- role, which bypasses RLS entirely, so the authoritative checks live in
-- src/lib/requests/permissions.ts. These policies exist to bound the damage if
-- something ever reaches these tables with a user's own JWT.

drop policy if exists "staff update requests" on public.requests;
drop policy if exists "assignee or admin update requests" on public.requests;
create policy "assignee or admin update requests" on public.requests
  for update to authenticated
  using (
    public.is_admin()
    or assigned_to = auth.uid()
    or (assigned_to is null and public.is_staff())
  )
  with check (public.is_admin() or assigned_to = auth.uid());

drop policy if exists "admin manages profiles" on public.profiles;
create policy "admin manages profiles" on public.profiles
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());
