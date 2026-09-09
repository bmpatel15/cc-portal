import { getPublicEnv } from '@/lib/env'

export function trackingUrl(token: string): string {
  return `${getPublicEnv().siteUrl.replace(/\/$/, '')}/track/${token}`
}

export function adminRequestUrl(requestId: string): string {
  return `${getPublicEnv().siteUrl.replace(/\/$/, '')}/admin?request=${requestId}`
}

/**
 * Where an attachment is read from.
 *
 * The link is derived from the row id every time it is rendered rather than
 * stored, so it follows a site-URL change and the authorisation rules instead of
 * freezing whatever was true when the file was uploaded.
 *
 * `trackingToken` is what lets a requester -- who has no account -- open their
 * own attachment. Staff links deliberately omit it: their session is the
 * credential, and a token in a staff inbox would be a second one worth stealing.
 */
export function filePath(fileId: string, trackingToken?: string | null): string {
  return trackingToken ? `/api/files/${fileId}?t=${trackingToken}` : `/api/files/${fileId}`
}

/** The absolute form, for emails and Telegram messages. */
export function fileUrl(fileId: string, trackingToken?: string | null): string {
  return `${getPublicEnv().siteUrl.replace(/\/$/, '')}${filePath(fileId, trackingToken)}`
}

/**
 * Where an emailed auth link should land.
 *
 * Whatever this returns has to be covered by the Redirect URLs allow-list in the
 * Supabase dashboard, or the auth server silently substitutes the Site URL and
 * the `next` hop is lost.
 */
export function authCallbackUrl(next?: string): string {
  const base = `${getPublicEnv().siteUrl.replace(/\/$/, '')}/auth/callback`
  return next ? `${base}?next=${encodeURIComponent(next)}` : base
}
