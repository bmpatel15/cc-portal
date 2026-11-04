-- cc-portal: accept PowerPoint decks, HEIC photos and other common image formats.
--
-- Apply with `supabase db push`, or paste into the Supabase SQL editor.
-- Safe to re-run: every statement is guarded, matching 0001's house style.

/* -------------------------------------------------------------------------- */
/* Storage                                                                    */
/* -------------------------------------------------------------------------- */

-- Requestors send slide decks to be printed or reworked, and photos straight
-- off an iPhone arrive as HEIC. Both were refused with 415.
--
-- The same full list is written in 0001, 0004 and 0005, for the reasons given in
-- 0004: each upserts allowed_mime_types, so a stale copy would revert this one.
-- It moves in lockstep with ALLOWED_FILE_TYPES in src/lib/schemas/request.ts.
--
-- SVG is left out on purpose. It can carry script, and a signed Storage URL
-- opens it inline in the browser.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'cc-portal',
  'cc-portal',
  false,
  104857600, -- 100MB
  array[
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/heic',
    'image/heif',
    'image/tiff',
    'image/avif',
    'image/bmp',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  ]
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
