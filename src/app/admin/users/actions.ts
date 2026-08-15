'use server'

import { revalidatePath } from 'next/cache'

import type { ActionResult } from '@/app/admin/actions'
import { requireActiveProfile } from '@/lib/auth/require'
import { inviteStaff, updateProfile } from '@/lib/profiles/service'
import { inviteSchema, profileUpdateSchema } from '@/lib/schemas/profile'

/**
 * Change a team member's role or access.
 *
 * Admin-only, and never your own row — `canManageProfile` enforces both, so a
 * project cannot be left with no admin.
 */
/** Create an account for a new staff member and email them a claim link. */
export async function inviteStaffAction(input: unknown): Promise<ActionResult> {
  const auth = await requireActiveProfile()
  if (!auth.ok) return { success: false, message: auth.message }

  const parsed = inviteSchema.safeParse(input)

  if (!parsed.success) {
    return { success: false, message: parsed.error.issues[0]?.message ?? 'Invalid invite' }
  }

  try {
    await inviteStaff(parsed.data, auth.actor)

    revalidatePath('/admin/users')
    revalidatePath('/admin')

    return { success: true, message: `Invite sent to ${parsed.data.email}` }
  } catch (error) {
    console.error('Invite failed:', error)
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Could not send the invite',
    }
  }
}

export async function updateProfileAction(input: unknown): Promise<ActionResult> {
  const auth = await requireActiveProfile()
  if (!auth.ok) return { success: false, message: auth.message }

  const parsed = profileUpdateSchema.safeParse(input)

  if (!parsed.success) {
    return { success: false, message: parsed.error.issues[0]?.message ?? 'Invalid change' }
  }

  try {
    await updateProfile(parsed.data, auth.actor)

    revalidatePath('/admin/users')
    revalidatePath('/admin')

    return { success: true, message: 'Team member updated' }
  } catch (error) {
    console.error('Profile update failed:', error)
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Could not update the team member',
    }
  }
}
