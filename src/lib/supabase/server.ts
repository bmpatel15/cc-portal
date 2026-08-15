import { createServerClient, type SetAllCookies } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getPublicEnv } from '@/lib/env'
import type { ProfileRow } from '@/lib/supabase/types'

type CookiesToSet = Parameters<SetAllCookies>[0]

/** Auth-aware client for server components, route handlers, and server actions. */
export async function getServerClient() {
  const { supabaseUrl, supabaseAnonKey } = getPublicEnv()
  const cookieStore = await cookies()

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet: CookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options)
          })
        } catch {
          // Called from a server component, where cookies are read-only.
          // The middleware refreshes the session instead.
        }
      },
    },
  })
}

/**
 * The signed-in staff profile, or null.
 *
 * A profile row is not on its own proof of access: the `handle_new_user` trigger
 * creates one for anyone who completes a magic link. Callers must check
 * `is_active` — the admin layout redirects, server actions refuse.
 */
export async function getCurrentProfile(): Promise<ProfileRow | null> {
  const supabase = await getServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const { data } = await supabase
    .from('profiles')
    .select('id, email, full_name, role, is_active, created_at')
    .eq('id', user.id)
    .maybeSingle()

  return (data as ProfileRow | null) ?? null
}
