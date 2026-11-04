import type { JwtPayload } from '@supabase/supabase-js'

/**
 * How long a sign-in lasts, however often the session is used in between.
 *
 * Supabase refreshes the access token for as long as the refresh token keeps
 * being used, so without this a phone with the site saved to its home screen
 * stays signed in indefinitely, and "Last signed in" on the Team page stops
 * meaning anything. Supabase's own time-box setting is a paid-plan feature, so
 * the app enforces it instead.
 */
export const MAX_SESSION_AGE_SECONDS = 48 * 60 * 60

/**
 * When this session was actually signed in to, in epoch seconds.
 *
 * `amr` records each authentication method with the moment it succeeded, and
 * unlike `iat` it is carried over unchanged when the token is refreshed. The
 * latest entry wins, so a later re-authentication counts as a fresh sign-in.
 * Null when the claim is missing or in the timestamp-less RFC 8176 string form.
 */
export function signedInAt(claims: JwtPayload): number | null {
  const timestamps = (claims.amr ?? []).flatMap((entry) =>
    typeof entry === 'object' && typeof entry.timestamp === 'number' ? [entry.timestamp] : [],
  )

  return timestamps.length > 0 ? Math.max(...timestamps) : null
}

/**
 * Whether this session has outlived MAX_SESSION_AGE_SECONDS.
 *
 * A session whose sign-in time cannot be read is let through rather than
 * signed out: Supabase always issues `amr`, so that only happens if a custom
 * access token hook rewrites it, and locking everyone out would be the worse
 * failure.
 */
export function isSessionExpired(claims: JwtPayload, now = Date.now() / 1000): boolean {
  const at = signedInAt(claims)

  return at !== null && now - at > MAX_SESSION_AGE_SECONDS
}
