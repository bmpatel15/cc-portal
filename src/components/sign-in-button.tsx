'use client'

import * as React from 'react'
import Link from 'next/link'
import { LayoutDashboard, LogIn } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { getBrowserClient } from '@/lib/supabase/client'

/**
 * Header link for the public pages: sign in, or straight back to the dashboard.
 *
 * The landing page is the natural place staff end up when they click the portal
 * title, and offering them "Team sign in" there is what makes an intact session
 * look like a lost one. The check is client-side on purpose — this page is
 * mostly served to requesters who have no session, and reading the cookie in the
 * browser keeps it out of the server render path.
 *
 * A session is not the same as dashboard access; /admin still decides that. So
 * this only changes where the button points, never what the holder may see.
 *
 * Styled for the dark header bar rather than the page surface, which is why it
 * carries its own colours instead of using a button variant.
 */
export function HeaderSignInButton() {
  const [signedIn, setSignedIn] = React.useState(false)

  React.useEffect(() => {
    // createBrowserClient throws when the NEXT_PUBLIC_* vars are missing from the
    // build; a public page should still render, just without the shortcut.
    let supabase
    try {
      supabase = getBrowserClient()
    } catch {
      return
    }

    let live = true

    supabase.auth.getSession().then(({ data }) => {
      if (live) setSignedIn(Boolean(data.session))
    })

    // Signing out in another tab should take the shortcut away here too.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (live) setSignedIn(Boolean(session))
    })

    return () => {
      live = false
      subscription.unsubscribe()
    }
  }, [])

  return (
    <Button
      asChild
      variant="ghost"
      size="sm"
      className="text-white/80 hover:bg-white/10 hover:text-white"
    >
      {signedIn ? (
        <Link href="/admin">
          <LayoutDashboard className="h-4 w-4" />
          <span className="hidden sm:inline">Dashboard</span>
        </Link>
      ) : (
        <Link href="/login">
          <LogIn className="h-4 w-4" />
          <span className="hidden sm:inline">Team sign in</span>
        </Link>
      )}
    </Button>
  )
}
