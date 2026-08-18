-- cc-portal: requests, files, status history, notification queue.
--
-- Apply with `supabase db push`, or paste into the Supabase SQL editor.
-- Safe to re-run: every statement is guarded.

/* -------------------------------------------------------------------------- */
/* Enums                                                                      */
/* -------------------------------------------------------------------------- */

do $$ begin
  create type public.request_status as enum ('pending', 'in_progress', 'review', 'complete', 'cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.request_team as enum ('audio', 'photo-video', 'content-creation');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.notification_channel as enum ('email', 'telegram');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.notification_status as enum ('pending', 'sent', 'failed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.user_role as enum ('admin', 'staff');
exception when duplicate_object then null; end $$;

/* -------------------------------------------------------------------------- */
/* Profiles — mirrors auth.users, adds a role for the admin dashboard          */
/* -------------------------------------------------------------------------- */

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text,
  role public.user_role not null default 'staff',
  created_at timestamptz not null default now()
);

-- Populate a profile whenever a user is created through Supabase Auth.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data ->> 'full_name')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Staff check used by the policies below. SECURITY DEFINER so that reading
-- profiles from inside a profiles policy does not recurse.
create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin', 'staff')
  );
$$;

/* -------------------------------------------------------------------------- */
/* Requests                                                                   */
/* -------------------------------------------------------------------------- */

create table if not exists public.requests (
  id uuid primary key default gen_random_uuid(),
  tracking_token uuid not null default gen_random_uuid(),

  -- requester
  full_name text not null,
  email text not null,
  phone text,
  department text not null,

  -- event
  event_name text not null,
  event_datetime timestamptz not null,

  -- request
  team public.request_team not null,
  details jsonb not null default '{}'::jsonb,

  -- workflow
  status public.request_status not null default 'pending',
  assigned_to uuid references public.profiles (id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists requests_tracking_token_key on public.requests (tracking_token);
create index if not exists requests_status_idx on public.requests (status);
create index if not exists requests_team_idx on public.requests (team);
create index if not exists requests_created_at_idx on public.requests (created_at desc);
create index if not exists requests_email_idx on public.requests (lower(email));

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists requests_touch_updated_at on public.requests;
create trigger requests_touch_updated_at
  before update on public.requests
  for each row execute function public.touch_updated_at();

/* -------------------------------------------------------------------------- */
/* Files                                                                      */
/* -------------------------------------------------------------------------- */

create table if not exists public.request_files (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.requests (id) on delete cascade,
  name text not null,
  storage_path text not null,
  url text not null,
  size_bytes bigint not null default 0,
  content_type text not null,
  created_at timestamptz not null default now()
);

create index if not exists request_files_request_id_idx on public.request_files (request_id);

/* -------------------------------------------------------------------------- */
/* Status history — powers the tracking timeline                              */
/* -------------------------------------------------------------------------- */

create table if not exists public.request_status_history (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.requests (id) on delete cascade,
  from_status public.request_status,
  to_status public.request_status not null,
  note text,
  changed_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists request_status_history_request_id_idx
  on public.request_status_history (request_id, created_at);

/* -------------------------------------------------------------------------- */
/* Notification queue — durable, retryable delivery                           */
/* -------------------------------------------------------------------------- */

create table if not exists public.notification_log (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.requests (id) on delete cascade,
  channel public.notification_channel not null,
  template text not null,
  recipient text not null,
  payload jsonb not null default '{}'::jsonb,
  status public.notification_status not null default 'pending',
  attempts int not null default 0,
  last_error text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists notification_log_pending_idx
  on public.notification_log (status, attempts, created_at)
  where status in ('pending', 'failed');

create index if not exists notification_log_request_id_idx on public.notification_log (request_id);

drop trigger if exists notification_log_touch_updated_at on public.notification_log;
create trigger notification_log_touch_updated_at
  before update on public.notification_log
  for each row execute function public.touch_updated_at();

/* -------------------------------------------------------------------------- */
/* Row level security                                                         */
/* -------------------------------------------------------------------------- */

-- Deny by default everywhere. The service role bypasses RLS entirely, which is
-- how public submission and token-based tracking reach the data — no anon policy
-- ever exposes the guessable tracking_token column to direct queries.

alter table public.profiles enable row level security;
alter table public.requests enable row level security;
alter table public.request_files enable row level security;
alter table public.request_status_history enable row level security;
alter table public.notification_log enable row level security;

drop policy if exists "own profile readable" on public.profiles;
create policy "own profile readable" on public.profiles
  for select to authenticated using (id = auth.uid() or public.is_staff());

drop policy if exists "staff read requests" on public.requests;
create policy "staff read requests" on public.requests
  for select to authenticated using (public.is_staff());

drop policy if exists "staff update requests" on public.requests;
create policy "staff update requests" on public.requests
  for update to authenticated using (public.is_staff()) with check (public.is_staff());

drop policy if exists "staff read files" on public.request_files;
create policy "staff read files" on public.request_files
  for select to authenticated using (public.is_staff());

drop policy if exists "staff read history" on public.request_status_history;
create policy "staff read history" on public.request_status_history
  for select to authenticated using (public.is_staff());

drop policy if exists "staff write history" on public.request_status_history;
create policy "staff write history" on public.request_status_history
  for insert to authenticated with check (public.is_staff());

drop policy if exists "staff read notifications" on public.notification_log;
create policy "staff read notifications" on public.notification_log
  for select to authenticated using (public.is_staff());

/* -------------------------------------------------------------------------- */
/* Storage                                                                    */
/* -------------------------------------------------------------------------- */

-- The bucket already exists in this project; this keeps a fresh environment in sync.
-- The mime list is kept identical to 0004_word_uploads.sql: the on-conflict
-- clause below is a declarative sync, so a stale array here would silently
-- revert 0004 the next time this file is re-run.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'cc-portal',
  'cc-portal',
  true,
  104857600, -- 100MB
  array[
    'image/jpeg',
    'image/png',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Uploads are performed with short-lived signed upload URLs minted server-side,
-- so no anon insert policy is needed. Reads stay public to match existing behaviour.
drop policy if exists "public read cc-portal" on storage.objects;
create policy "public read cc-portal" on storage.objects
  for select to public using (bucket_id = 'cc-portal');
