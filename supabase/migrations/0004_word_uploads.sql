-- cc-portal: accept Word documents as request attachments.
--
-- Apply with `supabase db push`, or paste into the Supabase SQL editor.
-- Safe to re-run: every statement is guarded, matching 0001's house style.

/* -------------------------------------------------------------------------- */
/* Storage                                                                    */
/* -------------------------------------------------------------------------- */

-- Requestors attach rough drawings and sketches to show what they want made,
-- and those arrive as .doc/.docx as often as they do as PDFs or photos.
--
-- Storage answers 415 for any upload whose mime type is absent from this array,
-- so it has to move in lockstep with ALLOWED_FILE_TYPES in
-- src/lib/schemas/request.ts. Drift in either direction reads as a client bug.
--
-- Written as the full list rather than array_append so it is idempotent without
-- a dedupe, and as an insert so a fresh project where the bucket does not exist
-- yet is provisioned correctly. 0001 seeds the same array; both are kept in
-- sync because 0001's on-conflict clause would otherwise revert this.
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
