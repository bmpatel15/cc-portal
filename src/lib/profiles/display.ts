import type { ProfileSummary } from '@/lib/supabase/types'

/**
 * What to call someone in the UI.
 *
 * `full_name` is optional — Supabase only populates it when the identity
 * provider supplies one — so fall back to the email local part rather than
 * showing a blank cell.
 */
export function displayName(profile: ProfileSummary): string {
  return profile.full_name?.trim() || profile.email.split('@')[0]
}
