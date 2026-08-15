import { redirect } from 'next/navigation'
import type { Metadata } from 'next'

import { listProfiles } from '@/lib/profiles/service'
import { getCurrentProfile } from '@/lib/supabase/server'

import { UsersTable } from './users-table'

export const metadata: Metadata = {
  title: 'Team',
}

export const dynamic = 'force-dynamic'

export default async function UsersPage() {
  const profile = await getCurrentProfile()

  if (!profile || !profile.is_active) redirect('/login')
  if (profile.role !== 'admin') redirect('/admin')

  const profiles = await listProfiles()

  return <UsersTable profiles={profiles} currentUserId={profile.id} />
}
