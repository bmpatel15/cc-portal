import { createHmac, timingSafeEqual } from 'node:crypto'

import { getServerEnv } from '@/lib/env'

/**
 * Proof that a storage path was minted by the sign route.
 *
 * `uploadedFileSchema` validates `path` as a non-empty string and nothing more,
 * so /api/requests had no way to tell a path it had issued from one the
 * submitter made up. Someone could attach an arbitrary object -- including
 * another request's file -- to their own request, and it would then be rendered
 * in the staff email and on their own tracking page, which their tracking token
 * unlocks.
 *
 * A signature closes that: the path is only accepted alongside a tag that only
 * this server can produce.
 *
 * Keyed on the service role key rather than a new secret, because a new required
 * env var breaks the deploy of anyone who has not set it yet, and this key is
 * already server-only and high entropy. The domain prefix keeps a tag minted
 * here from being meaningful anywhere else that might one day key off the same
 * secret.
 */
const DOMAIN = 'cc-portal:upload-path:v1'

export function signUploadPath(path: string): string {
  return createHmac('sha256', getServerEnv().supabaseServiceRoleKey)
    .update(`${DOMAIN}:${path}`)
    .digest('hex')
}

export function verifyUploadPath(path: string, signature: string): boolean {
  const expected = Buffer.from(signUploadPath(path), 'hex')
  const provided = Buffer.from(signature, 'hex')

  // Compared in constant time, and only once the lengths match -- timingSafeEqual
  // throws on a mismatch rather than returning false, and a wrong length is
  // already a wrong signature.
  if (provided.length !== expected.length) return false

  return timingSafeEqual(expected, provided)
}
