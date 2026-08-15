import { getPublicEnv } from '@/lib/env'

export function trackingUrl(token: string): string {
  return `${getPublicEnv().siteUrl.replace(/\/$/, '')}/track/${token}`
}

export function adminRequestUrl(requestId: string): string {
  return `${getPublicEnv().siteUrl.replace(/\/$/, '')}/admin?request=${requestId}`
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
