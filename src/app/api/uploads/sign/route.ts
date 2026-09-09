import { NextResponse } from 'next/server'
import { ALLOWED_FILE_LABEL, signUploadSchema } from '@/lib/schemas/request'
import { STORAGE_BUCKET, getAdminClient } from '@/lib/supabase/admin'
import { resolveFileType, sanitizeFileName } from '@/lib/files'

export const runtime = 'nodejs'

/**
 * How many upload URLs one address may mint per hour.
 *
 * Generous on purpose. A single request can legitimately carry ten attachments,
 * and a mandir or office shares one address behind NAT, so a tight cap would
 * lock out a whole building before it inconvenienced anyone abusing the
 * endpoint. Ten full submissions an hour still bounds the damage hard.
 */
const MAX_SIGNATURES_PER_HOUR = 100

/**
 * Who is asking, as well as this can be known behind a proxy.
 *
 * `NextRequest.ip` was removed in Next 15, so the forwarded headers are all
 * there is. The first entry of x-forwarded-for is the client; the rest are
 * proxies. A caller can forge this header, but only to spread their own usage
 * across buckets -- they cannot use it to exhaust anyone else's, because the
 * limit is per key rather than global.
 */
function callerKey(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')
  const first = forwarded?.split(',')[0]?.trim()

  return first || request.headers.get('x-real-ip')?.trim() || 'unknown'
}

/**
 * True when this caller has already had its hour's worth.
 *
 * Fails open. A rate limiter that is down must not take request submission down
 * with it -- accepting some abuse during a Postgres blip is much cheaper than
 * turning away every requestor in the meantime.
 */
async function isRateLimited(request: Request): Promise<boolean> {
  const { data, error } = await getAdminClient().rpc('record_upload_attempt', {
    p_ip: callerKey(request),
  })

  if (error) {
    console.error('Upload rate limit check failed; allowing the request:', error.message)
    return false
  }

  return typeof data === 'number' && data > MAX_SIGNATURES_PER_HOUR
}

/**
 * Mint a short-lived signed upload URL so the browser can PUT the file straight
 * to Supabase Storage. Keeps 100MB payloads out of the serverless function
 * entirely — the old route streamed every byte through Next.
 */
export async function POST(request: Request) {
  if (await isRateLimited(request)) {
    return NextResponse.json(
      { success: false, message: 'Too many uploads from this network. Try again later.' },
      { status: 429 },
    )
  }

  let body: unknown

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, message: 'Expected a JSON body' }, { status: 400 })
  }

  const parsed = signUploadSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { success: false, message: parsed.error.issues[0]?.message ?? 'Invalid file' },
      { status: 422 },
    )
  }

  const { fileName } = parsed.data

  // Derived from the name, never from the client's claim: this route is
  // unauthenticated, so a supplied contentType proves nothing about the file it
  // names, and the browser's own value is unreliable for Word documents anyway.
  const contentType = resolveFileType(fileName)

  if (!contentType) {
    return NextResponse.json(
      { success: false, message: `Upload a ${ALLOWED_FILE_LABEL} file` },
      { status: 422 },
    )
  }

  const path = `files/${Date.now()}_${crypto.randomUUID().slice(0, 8)}_${sanitizeFileName(fileName)}`

  const { data, error } = await getAdminClient()
    .storage.from(STORAGE_BUCKET)
    .createSignedUploadUrl(path)

  if (error || !data) {
    console.error('Failed to create signed upload URL:', error)
    return NextResponse.json(
      { success: false, message: 'Could not prepare the upload. Please try again.' },
      { status: 500 },
    )
  }

  return NextResponse.json({
    success: true,
    path: data.path,
    token: data.token,
    signedUrl: data.signedUrl,
    contentType,
  })
}
