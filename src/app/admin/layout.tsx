import Link from 'next/link'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { KeyRound, Users } from 'lucide-react'

import { SiteHeader } from '@/components/site-header'
import { Button } from '@/components/ui/button'
import { getCurrentProfile } from '@/lib/supabase/server'

import { SignOutButton } from './sign-out-button'

export const metadata: Metadata = {
  title: 'Dashboard',
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile()

  // No session at all.
  if (!profile) redirect('/login')

  // A profile row is created for anyone who completes a magic link, so it is
  // approval — not the row — that grants access.
  if (!profile.is_active) redirect('/login?pending=1')

  const isAdmin = profile.role === 'admin'

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader
        title="Request Dashboard"
        subtitle={profile.email}
        homeHref="/admin"
        action={
          <>
            {isAdmin ? (
              <Button
                asChild
                variant="ghost"
                size="sm"
                className="text-white/80 hover:bg-white/10 hover:text-white"
              >
                <Link href="/admin/users">
                  <Users className="h-4 w-4" />
                  <span className="hidden sm:inline">Team</span>
                </Link>
              </Button>
            ) : null}
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="text-white/80 hover:bg-white/10 hover:text-white"
            >
              <Link href="/account/password">
                <KeyRound className="h-4 w-4" />
                <span className="hidden lg:inline">Password</span>
              </Link>
            </Button>
            <SignOutButton />
          </>
        }
      />
      <main className="flex-1 bg-muted/30 py-6 sm:py-8">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">{children}</div>
      </main>
    </div>
  )
}
