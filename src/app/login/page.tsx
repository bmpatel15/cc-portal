import { redirect } from 'next/navigation'

import { SiteHeader } from '@/components/site-header'
import { getCurrentProfile } from '@/lib/supabase/server'

import { SignInCard } from './sign-in-card'

// The session lives in a cookie, so this page can never be prerendered — it has
// to look at who is asking before it decides to show a form.
export const dynamic = 'force-dynamic'

/**
 * Signing in once is enough.
 *
 * Anyone who still holds a session should not be asked for a password again just
 * because they navigated here — from the landing page, a bookmark, or a stale
 * tab. Only an approved account is sent on: a signed-in but unapproved one has
 * to stay and read the pending notice, or /admin would bounce it straight back.
 */
export default async function LoginPage() {
  const profile = await getCurrentProfile()

  if (profile?.is_active) redirect('/admin')

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader subtitle="Team sign in" />

      <main className="flex flex-1 items-center justify-center bg-muted/30 px-4 py-10">
        <SignInCard />
      </main>
    </div>
  )
}
