'use server'

import { revalidatePath } from 'next/cache'

import { requireActiveProfile } from '@/lib/auth/require'
import { assignmentSchema, statusUpdateSchema } from '@/lib/schemas/request'
import { assignRequest, updateRequestStatus } from '@/lib/requests/service'
import { deleteTimeEntry, logTime } from '@/lib/analytics/service'
import { deleteTimeEntrySchema, timeEntrySchema } from '@/lib/schemas/analytics'

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

/**
 * Record hours worked against a request.
 *
 * Open to any active staff member rather than admins only: the people doing the
 * work are the ones who know how long it took, and a log only admins can write
 * would stay empty. Reading the aggregate is still admin-only.
 */
export async function logTimeAction(input: unknown): Promise<ActionResult> {
  const auth = await requireActiveProfile()
  if (!auth.ok) return { success: false, message: auth.message }

  const parsed = timeEntrySchema.safeParse(input)

  if (!parsed.success) {
    return { success: false, message: parsed.error.issues[0]?.message ?? 'Invalid entry' }
  }

  try {
    await logTime(parsed.data, auth.actor.id)

    revalidatePath('/admin')
    revalidatePath('/admin/analytics')

    return { success: true, message: 'Time logged' }
  } catch (error) {
    return failure(error, 'Could not log the time')
  }
}

/** Remove a logged entry. Staff may remove their own; admins may remove any. */
export async function deleteTimeEntryAction(input: unknown): Promise<ActionResult> {
  const auth = await requireActiveProfile()
  if (!auth.ok) return { success: false, message: auth.message }

  const parsed = deleteTimeEntrySchema.safeParse(input)

  if (!parsed.success) {
    return { success: false, message: parsed.error.issues[0]?.message ?? 'Invalid entry' }
  }

  try {
    const removed = await deleteTimeEntry(parsed.data.entryId, auth.actor)

    revalidatePath('/admin')
    revalidatePath('/admin/analytics')

    return removed
      ? { success: true, message: 'Entry removed' }
      : { success: false, message: 'That entry is not yours to remove' }
  } catch (error) {
    return failure(error, 'Could not remove the entry')
  }
}
