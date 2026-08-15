import { NextResponse } from 'next/server'

import { getServerClient } from '@/lib/supabase/server'

/**
 * Only same-site paths may be followed.
 *
 * `next` arrives in a link that lands in someone's inbox, so it is attacker-
 * controllable. A leading `//` (or `/\`) is protocol-relative and would send the
 * browser to another host once joined to the origin.
 */
function safeNext(next: string | null): string {
  if (!next || !next.startsWith('/')) return '/admin'
  if (next.startsWith('//') || next.startsWith('/\\')) return '/admin'
  return next
}

/**
 * Exchanges the emailed code for a session cookie, then lands where the flow
 * asked for — the dashboard for a sign-in link, /account/password for a reset.
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
