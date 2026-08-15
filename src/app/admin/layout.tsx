import { redirect } from 'next/navigation'
import type { Metadata } from 'next'

import { SiteHeader } from '@/components/site-header'
import { getCurrentProfile } from '@/lib/supabase/server'

import { SignOutButton } from './sign-out-button'

export const metadata: Metadata = {
  title: 'Dashboard',
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile()

  // No session, or a user without a staff profile row.
  if (!profile) redirect('/login')

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader
        title="Request Dashboard"
        subtitle={profile.email}
        action={<SignOutButton />}
      />
      <main className="flex-1 bg-muted/30 py-6 sm:py-8">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">{children}</div>
      </main>
    </div>
  )
}
