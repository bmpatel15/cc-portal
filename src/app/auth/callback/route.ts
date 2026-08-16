import { NextResponse } from 'next/server'

import { safeNext } from '@/lib/auth/redirect'
import { getServerClient } from '@/lib/supabase/server'

/**
 * Exchanges the emailed PKCE code for a session cookie, then lands where the
 * flow asked for — the dashboard for a sign-in link, /account/password for a
 * reset.
 *
 * Only handles browser-initiated links, which carry a `code`. Admin-generated
 * invites have no code_verifier and arrive as a token hash instead; those go to
 * /auth/confirm.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = safeNext(searchParams.get('next'))

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`)
  }

  const supabase = await getServerClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(error.message)}`)
  }

  return NextResponse.redirect(`${origin}${next}`)
}
