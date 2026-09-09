import { redirect } from 'next/navigation'

import { listActiveStaff } from '@/lib/profiles/service'
import { getStaffRequestById, listRequests } from '@/lib/requests/service'
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

  const [list, staff, params] = await Promise.all([
    listRequests(),
    listActiveStaff(),
    searchParams,
  ])

  const requestId = params.request ?? null

  // Staff notification emails link to /admin?request=<id>, and the board only
  // loads the newest slice. A link to anything older used to set the selection
  // to an id that was not in the list, so the drawer rendered nothing at all --
  // the link simply did nothing, with no error to explain it. Fetch the one row
  // that is missing rather than widening the whole query.
  const missing =
    requestId && !list.requests.some((request) => request.id === requestId)
      ? await getStaffRequestById(requestId)
      : null

  return (
    <RequestsBoard
      requests={missing ? [missing, ...list.requests] : list.requests}
      actor={profile}
      staff={staff}
      truncated={list.truncated}
      total={list.total}
      initialRequestId={requestId}
    />
  )
}
