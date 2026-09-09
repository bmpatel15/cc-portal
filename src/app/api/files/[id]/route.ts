import { NextResponse } from 'next/server'
import { requireActiveProfile } from '@/lib/auth/require'
import { STORAGE_BUCKET, getAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Serve one request attachment to someone entitled to see it.
 *
 * The bucket is private (0005_private_file_access.sql), so this is the only way
 * in. Two credentials are accepted, because two audiences need the same file:
 * staff work the request from the dashboard and have a session, while the
 * requester has no account at all -- only the tracking token from their
 * confirmation email.
 *
 * The URL is deliberately permanent. It goes into emails and Telegram messages
 * that outlive any signature, so authorisation happens on every hit rather than
 * being baked into the link once.
 */

/** How long the signed URL this route hands out stays valid, in seconds. */
const SIGNED_URL_TTL = 60

/**
 * A malformed id is refused before it costs a query. The token needs no such
 * guard -- nothing is ever looked up by it, it is only compared to the value on
 * the row this id already found.
 */
const UUID_PATTERN = /^[0-9a-f-]{36}$/i

/**
 * The embed infers loosely through the foreign key, so the shape is named here
 * rather than fought with generics.
 */
interface FileWithParent {
  id: string
  name: string
  storage_path: string
  requests: { tracking_token: string } | null
}

/**
 * One body for every refusal.
 *
 * A 403 would confirm that a file exists to someone holding nothing but an id,
 * which is exactly what an enumeration attempt is looking for. Missing, denied
 * and broken all look identical from outside.
 */
function notFound() {
  return NextResponse.json({ success: false, message: 'Not found' }, { status: 404 })
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const token = new URL(request.url).searchParams.get('t')

  if (!UUID_PATTERN.test(id)) return notFound()

  // A tracking token means a requestor, and a requestor has no account, so the
  // anonymous path never pays for a Supabase Auth round trip. Staff arrive with
  // a warm session cookie either way.
  const auth = token === null ? await requireActiveProfile() : null

  // Decided before the row is looked up, so it says nothing about whether this
  // file exists. Staff reach these links from the notification email, and a bare
  // 404 for someone who is merely signed out reads as a broken link rather than
  // as "sign in first".
  if (auth !== null && !auth.ok) {
    const signIn = NextResponse.redirect(new URL('/login', request.url), 302)

    // Whether this redirects at all depends on the caller's session, so it must
    // not be reused for anyone else. Next's default here is `public`.
    signIn.headers.set('Cache-Control', 'private, no-store')

    return signIn
  }

  const { data, error } = await getAdminClient()
    .from('request_files')
    .select('id, name, storage_path, requests!inner (tracking_token)')
    .eq('id', id)
    .maybeSingle()

  if (error || !data) return notFound()

  const file = data as unknown as FileWithParent

  // A token only ever unlocks files belonging to its own request, so holding one
  // tracking link grants nothing anywhere else.
  //
  // Where there is no token the session already stood in for this, and it is an
  // active profile of any role -- visibility here is role-based rather than
  // assignment-based (`staff read files` in 0001 gates on is_staff(), and
  // assigned_to only governs mutations), so a non-admin assignee must be able to
  // open the files for their own job.
  if (token !== null && token !== file.requests?.tracking_token) return notFound()

  const { data: signed, error: signError } = await getAdminClient()
    .storage.from(STORAGE_BUCKET)
    .createSignedUrl(file.storage_path, SIGNED_URL_TTL)

  if (signError || !signed) {
    console.error(`Failed to sign ${file.storage_path}:`, signError)
    return notFound()
  }

  // Redirect rather than stream the bytes back. supabase-js buffers a whole
  // object into memory on download, and a 100MB attachment through a serverless
  // function would blow both the heap and Vercel's response limits. Handing back
  // a short-lived URL keeps the transfer between the browser and Storage, where
  // range requests and resume work on their own.
  const response = NextResponse.redirect(signed.signedUrl, 302)

  // Neither the redirect nor the URL it carries may be reused from a shared
  // cache: the next visitor is not necessarily the one who was authorised.
  response.headers.set('Cache-Control', 'private, no-store')

  return response
}
