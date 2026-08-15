'use server'

import { revalidatePath } from 'next/cache'

import { statusUpdateSchema } from '@/lib/schemas/request'
import { updateRequestStatus } from '@/lib/requests/service'
import { getCurrentProfile } from '@/lib/supabase/server'

export interface ActionResult {
  success: boolean
  message: string
}

/**
 * Move a request to a new status.
 *
 * Writes the history row and queues the submitter's status-change email; the
 * queue makes that email retryable rather than fire-and-forget.
 */
export async function updateStatusAction(input: unknown): Promise<ActionResult> {
  const profile = await getCurrentProfile()

  if (!profile) {
    return { success: false, message: 'You are not signed in' }
  }

  const parsed = statusUpdateSchema.safeParse(input)

  if (!parsed.success) {
    return { success: false, message: parsed.error.issues[0]?.message ?? 'Invalid update' }
  }

  try {
    const changed = await updateRequestStatus(
      parsed.data.requestId,
      parsed.data.status,
      parsed.data.note || undefined,
      profile.id,
    )

    revalidatePath('/admin')

    return {
      success: true,
      message: changed ? 'Status updated and the requester was notified' : 'Status unchanged',
    }
  } catch (error) {
    console.error('Status update failed:', error)
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Could not update the status',
    }
  }
}
