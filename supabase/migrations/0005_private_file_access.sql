-- cc-portal: make request attachments private and served through the app.
--
-- Apply with `supabase db push`, or paste into the Supabase SQL editor.
-- Safe to re-run: every statement is guarded, matching 0001's house style.

/* -------------------------------------------------------------------------- */
/* Storage                                                                    */
/* -------------------------------------------------------------------------- */

-- The bucket was public, and 0001 granted `select` on it to the `public` role.
-- Between them, anyone holding NEXT_PUBLIC_SUPABASE_ANON_KEY -- which is public
-- by definition -- could list the bucket and download every requester's
-- attachment. Requesters upload sketches and Word documents alongside their
-- name, department and email, so that was a real disclosure, not a theoretical
-- one.
--
-- Reads now go through GET /api/files/[id], which authorises the caller (an
-- active staff profile, or the tracking token belonging to that file's request)
-- and hands back a 60-second signed URL. The service role mints those and
-- bypasses RLS, so no select policy is needed here at all.
--
-- The `public` flag is set in three files -- here, 0001 and 0004 -- because both
-- of those upsert `public = excluded.public`. Flipping it only here would be
-- silently reverted the next time either of them was re-run.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'cc-portal',
  'cc-portal',
  false,
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

drop policy if exists "public read cc-portal" on storage.objects;

/* -------------------------------------------------------------------------- */
/* Files                                                                      */
/* -------------------------------------------------------------------------- */

-- `url` held a public Storage URL built by string concatenation at insert time.
-- It cannot hold the truth any more: the same file now needs a tokenless link
-- for staff and a `?t=` link for the requester, and one column cannot store
-- two. Links are derived from the row id at render time instead, so they follow
-- a NEXT_PUBLIC_SITE_URL change and any future auth change with no backfill.
--
-- Kept rather than dropped so a deploy lagging this migration still reads.
-- Existing values are dead data; a `drop column` can follow once nothing writes
-- it.
alter table public.request_files alter column url drop not null;

comment on column public.request_files.url is
  'Legacy. Nothing reads or writes this; links come from /api/files/<id>.';
