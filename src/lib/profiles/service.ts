import { canInviteStaff, canManageProfile, type Actor } from '@/lib/requests/permissions'
import type { Invite, ProfileUpdate } from '@/lib/schemas/profile'
import { getAdminClient } from '@/lib/supabase/admin'
import type { ProfileRow, ProfileSummary } from '@/lib/supabase/types'
import { authCallbackUrl } from '@/lib/urls'

/**
 * Team membership.
 *
 * Reads go through the service role like the rest of the app, so the admin-only
 * rules are enforced here in TypeScript rather than by RLS.
 */

const PROFILE_SELECT = 'id, email, full_name, role, is_active, created_at'

/** Everyone with a profile, including accounts still waiting for approval. */
export async function listProfiles(): Promise<ProfileRow[]> {
  const { data, error } = await getAdminClient()
    .from('profiles')
    .select(PROFILE_SELECT)
    .order('created_at', { ascending: true })

  if (error) throw new Error(`Failed to load team members: ${error.message}`)
  return (data ?? []) as ProfileRow[]
}

/** Candidates for the assignment dropdown. */
export async function listActiveStaff(): Promise<ProfileSummary[]> {
  const { data, error } = await getAdminClient()
    .from('profiles')
    .select('id, email, full_name')
    .eq('is_active', true)
    .order('full_name', { ascending: true, nullsFirst: false })

  if (error) throw new Error(`Failed to load staff: ${error.message}`)
  return (data ?? []) as ProfileSummary[]
}

/**
 * Create an account for someone and email them a link to claim it.
 *
 * The invite lands on the set-password page, so a new joiner leaves with a
 * password rather than depending on a link every time. Unlike a self-service
 * signup the invitee is pre-approved — an admin picked them deliberately, so
 * there is nothing left to approve. `is_active` stays as the revocation switch.
 */
export async function inviteStaff(values: Invite, actor: Actor): Promise<void> {
  const permitted = canInviteStaff(actor)
  if (!permitted.ok) throw new Error(permitted.reason)

  const supabase = getAdminClient()

  const { data, error } = await supabase.auth.admin.inviteUserByEmail(values.email, {
    redirectTo: authCallbackUrl('/account/password'),
  })

  if (error || !data?.user) {
    const message = error?.message ?? 'unknown error'
    if (/already been registered|already exists/i.test(message)) {
      throw new Error('That email already has an account — set their role in the list below')
    }
    throw new Error(`Could not send the invite: ${message}`)
  }

  // `handle_new_user` will have inserted a default row; upsert so the intended
  // role and access apply either way.
  const { error: profileError } = await supabase.from('profiles').upsert(
    {
      id: data.user.id,
      email: data.user.email ?? values.email,
      role: values.role,
      is_active: true,
    },
    { onConflict: 'id' },
  )

  if (profileError) {
    throw new Error(
      `Invite sent, but the account could not be activated: ${profileError.message}`,
    )
  }
}

export async function updateProfile(values: ProfileUpdate, actor: Actor): Promise<void> {
  const permitted = canManageProfile(actor, values.profileId)
  if (!permitted.ok) throw new Error(permitted.reason)

  const { error } = await getAdminClient()
    .from('profiles')
    .update({ role: values.role, is_active: values.isActive })
    .eq('id', values.profileId)

  if (error) throw new Error(`Failed to update the team member: ${error.message}`)
}
