import type { Actor } from '@/lib/requests/permissions'
import { getCurrentProfile } from '@/lib/supabase/server'

/**
 * Establish who is calling a server action.
 *
 * Actions are reachable independently of the pages that render them, so each one
 * re-checks rather than trusting its caller. A profile row on its own is not
 * authorisation — the `handle_new_user` trigger creates one for every magic-link
 * signup — hence the `is_active` check.
 *
 * Deliberately not in a `'use server'` module: exports there become callable
 * endpoints, and this is a helper, not an action.
 */
export async function requireActiveProfile(): Promise<
  { ok: true; actor: Actor } | { ok: false; message: string }
> {
  const profile = await getCurrentProfile()

  if (!profile) return { ok: false, message: 'You are not signed in' }
  if (!profile.is_active) {
    return { ok: false, message: 'Your account is waiting for an admin to approve it' }
  }

  return { ok: true, actor: profile }
}
