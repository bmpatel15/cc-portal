import { listRequests } from '@/lib/requests/service'

import { RequestsBoard } from './requests-board'

// Staff need to see status changes made by other staff without a hard reload.
export const dynamic = 'force-dynamic'

export default async function AdminPage() {
  const requests = await listRequests()

  return <RequestsBoard requests={requests} />
}
