import { createServerClient, type SetAllCookies } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { isSessionExpired } from '@/lib/auth/session-age'

type CookiesToSet = Parameters<SetAllCookies>[0]

/**
 * Refreshes the Supabase auth session cookie on admin routes, and signs out a
 * session more than MAX_SESSION_AGE_SECONDS past its sign-in.
 *
 * The previous middleware guarded request body size; uploads now go straight to
 * storage with signed URLs, so nothing large reaches the app and that check is
 * no longer needed.
 */
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  // Next inlines NEXT_PUBLIC_* at build time, so a deployment built without
  // them leaves these undefined and createServerClient throws — which surfaces
  // as MIDDLEWARE_INVOCATION_FAILED and takes down every matched route.
  //
  // This middleware refreshes an expiring session cookie and ends over-age
  // ones; it is not the guard. The admin layout and the server actions are, and
  // they fail closed on their own (getCurrentProfile rejects over-age sessions
  // too). So passing through is the safe degradation: a
  // misconfigured deploy shows a login page instead of a 500.
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error(
      'Middleware: NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY are missing from this build. Sessions will not refresh.',
    )
    return response
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet: CookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        response = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        )
      },
    },
  })

  try {
    // Touching the user refreshes an expiring session and writes the new cookies.
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (user) {
      const { data } = await supabase.auth.getClaims()

      if (data && isSessionExpired(data.claims)) {
        // Revokes this session's refresh token and, through setAll above,
        // clears the cookies on both the request and the response.
        await supabase.auth.signOut({ scope: 'local' })

        // The login page renders fine with the cookies gone; anywhere else is
        // sent there with a reason, so the sign-out doesn't look like a bug.
        if (request.nextUrl.pathname !== '/login') {
          const signIn = NextResponse.redirect(new URL('/login?expired=1', request.url), 302)
          response.cookies.getAll().forEach((cookie) => signIn.cookies.set(cookie))
          signIn.headers.set('Cache-Control', 'private, no-store')
          return signIn
        }
      }
    }
  } catch (error) {
    // A refresh failure is not worth a 500 either — the request continues with
    // whatever cookie it arrived with, and the route's own guard decides.
    console.error('Middleware: session refresh failed.', error)
  }

  return response
}

export const config = {
  matcher: ['/admin/:path*', '/account/:path*', '/login'],
}
