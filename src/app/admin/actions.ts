'use server'

import { revalidatePath } from 'next/cache'

import { requireActiveProfile } from '@/lib/auth/require'
import { assignmentSchema, statusUpdateSchema } from '@/lib/schemas/request'
import { assignRequest, updateRequestStatus } from '@/lib/requests/service'

export interface ActionResult {
  success: boolean
  message: string
}

function failure(error: unknown, fallback: string): ActionResult {
  console.error(`${fallback}:`, error)
  return { success: false, message: error instanceof Error ? error.message : fallback }
}

/**
 * Move a request to a new status.
 *
 * Writes the history row and queues the submitter's status-change email; the
 * queue makes that email retryable rather than fire-and-forget. Whether this
 * actor may make this particular move is decided inside `updateRequestStatus`,
 * against the stored row.
 */
export async function updateStatusAction(input: unknown): Promise<ActionResult> {
  const auth = await requireActiveProfile()
  if (!auth.ok) return { success: false, message: auth.message }

  const parsed = statusUpdateSchema.safeParse(input)

  if (!parsed.success) {
    return { success: false, message: parsed.error.issues[0]?.message ?? 'Invalid update' }
  }

  try {
    const changed = await updateRequestStatus(
      parsed.data.requestId,
      parsed.data.status,
      parsed.data.note || undefined,
      auth.actor,
    )

    revalidatePath('/admin')

    return {
      success: true,
      message: changed ? 'Status updated and the requester was notified' : 'Status unchanged',
    }
  } catch (error) {
    return failure(error, 'Could not update the status')
  }
}

/** Claim a request, or — for admins — place it with anyone. */
export async function assignRequestAction(input: unknown): Promise<ActionResult> {
  const auth = await requireActiveProfile()
  if (!auth.ok) return { success: false, message: auth.message }

  const parsed = assignmentSchema.safeParse(input)

  if (!parsed.success) {
    return { success: false, message: parsed.error.issues[0]?.message ?? 'Invalid assignment' }
  }

  try {
    await assignRequest(parsed.data.requestId, parsed.data.assigneeId, auth.actor)

    revalidatePath('/admin')

    return {
      success: true,
      message: parsed.data.assigneeId ? 'Request assigned' : 'Request unassigned',
    }
  } catch (error) {
    return failure(error, 'Could not assign the request')
  }
}
