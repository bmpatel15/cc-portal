import { createServerClient, type SetAllCookies } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

type CookiesToSet = Parameters<SetAllCookies>[0]

/**
 * Refreshes the Supabase auth session cookie on admin routes.
 *
 * The previous middleware guarded request body size; uploads now go straight to
 * storage with signed URLs, so nothing large reaches the app and that check is
 * no longer needed.
 */
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
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
    },
  )

  // Touching the user refreshes an expiring session and writes the new cookies.
  await supabase.auth.getUser()

  return response
}

export const config = {
  matcher: ['/admin/:path*', '/login'],
}
