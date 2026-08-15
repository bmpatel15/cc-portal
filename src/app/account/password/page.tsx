import { redirect } from 'next/navigation'
import type { Metadata } from 'next'

import { getServerClient } from '@/lib/supabase/server'

import { PasswordForm } from './password-form'

export const metadata: Metadata = {
  title: 'Password',
}

export const dynamic = 'force-dynamic'

/**
 * Deliberately outside /admin: a staff member who is signed in but not yet
 * approved should still be able to set a password, and a password-reset link
 * lands here before anyone knows whether they have dashboard access.
 */
export default async function PasswordPage() {
  const supabase = await getServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  return <PasswordForm email={user.email ?? ''} />
}
