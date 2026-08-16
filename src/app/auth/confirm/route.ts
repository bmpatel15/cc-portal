import type { EmailOtpType } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'

import { safeNext } from '@/lib/auth/redirect'
import { getServerClient } from '@/lib/supabase/server'

/**
 * Verifies an emailed token hash and starts a session.
 *
 * This exists because /auth/callback cannot serve an invite. A browser-initiated
 * link (magic link, password reset) uses PKCE: the browser holds a code_verifier,
 * so Supabase returns `?code=` and the callback exchanges it. An invite is minted
 * server-side by `inviteUserByEmail`, so the invitee's browser has no verifier —
 * Supabase falls back to the implicit flow and returns the session in a URL
 * *fragment*, which is never sent to a server. The callback therefore sees no
 * code at all.
 *
 * The fix Supabase documents for SSR is to have the email template send
 * `token_hash` as a query parameter and verify it here, server-side, where the
 * session can be written straight into cookies.
 *
 * Requires the Invite template in the dashboard to point here:
 *   {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite&next=/account/password
 */

/** Someone arriving by invite or reset needs a password before anything else. */
function destinationFor(type: EmailOtpType): string {
  return type === 'invite' || type === 'recovery' ? '/account/password' : '/admin'
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const tokenHash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null

  if (!tokenHash || !type) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`)
  }

  const next = safeNext(searchParams.get('next'), destinationFor(type))

  const supabase = await getServerClient()
  const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash })

  if (error) {
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(error.message)}`)
  }

  return NextResponse.redirect(`${origin}${next}`)
}
