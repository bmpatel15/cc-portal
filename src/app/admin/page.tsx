import { redirect } from 'next/navigation'

import { listActiveStaff } from '@/lib/profiles/service'
import { listRequests } from '@/lib/requests/service'
import { getCurrentProfile } from '@/lib/supabase/server'

import { RequestsBoard } from './requests-board'

// Staff need to see status changes made by other staff without a hard reload.
export const dynamic = 'force-dynamic'

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ request?: string }>
}) {
  // The layout already gates access; this repeats the lookup because the board
  // needs to know who is looking in order to decide what it may offer them.
  const profile = await getCurrentProfile()
  if (!profile || !profile.is_active) redirect('/login')

  const [requests, staff, params] = await Promise.all([
    listRequests(),
    listActiveStaff(),
    searchParams,
  ])

  return (
    <RequestsBoard
      requests={requests}
      actor={profile}
      staff={staff}
      // Staff notification emails link to /admin?request=<id>; open it directly.
      initialRequestId={params.request ?? null}
    />
  )
}
