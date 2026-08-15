import { STATUS_PIPELINE, type RequestStatus } from '@/lib/schemas/request'
import type { ProfileRow, RequestRow } from '@/lib/supabase/types'

/**
 * Who may move a request, and where to.
 *
 * Pure functions with no I/O, so the admin UI can grey out what the server would
 * refuse and both answer from the same rules. The server is still the authority:
 * every mutation re-checks here before writing, because the dashboard talks to
 * Postgres through the service-role client and RLS never runs for it.
 *
 *   staff  — claim unassigned work, then advance their own request forward
 *   admin  — anything, on any request: reassign, reopen, cancel
 */

export type Actor = Pick<ProfileRow, 'id' | 'role' | 'is_active'>

/** A request only needs these two fields to be judged. */
export type Subject = Pick<RequestRow, 'status' | 'assigned_to'>

export type Permission = { ok: true } | { ok: false; reason: string }

const allow: Permission = { ok: true }
const deny = (reason: string): Permission => ({ ok: false, reason })

function isAdmin(actor: Actor): boolean {
  return actor.is_active && actor.role === 'admin'
}

function isStaff(actor: Actor): boolean {
  return actor.is_active && (actor.role === 'staff' || actor.role === 'admin')
}

/** Position on the happy path, or -1 for `cancelled`, which is not a stage. */
function stageIndex(status: RequestStatus): number {
  return (STATUS_PIPELINE as readonly RequestStatus[]).indexOf(status)
}

/* -------------------------------------------------------------------------- */
/* Status                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * `reason` is shown to the user verbatim, so it is written for a human rather
 * than for a log.
 */
export function canChangeStatus(actor: Actor, request: Subject, to: RequestStatus): Permission {
  if (!isStaff(actor)) return deny('Your account is not active')
  if (isAdmin(actor)) return allow

  if (!request.assigned_to) return deny('Claim this request before updating it')
  if (request.assigned_to !== actor.id) return deny('This request is assigned to someone else')

  if (to === 'cancelled') return deny('Only an admin can cancel a request')
  if (request.status === 'cancelled') return deny('Only an admin can reopen a cancelled request')
  if (request.status === 'complete') return deny('Only an admin can reopen a completed request')

  // Forward-only along the pipeline. Skipping a stage is fine — not every job
  // needs a review pass — but nothing moves backwards without an admin.
  if (stageIndex(to) <= stageIndex(request.status)) {
    return deny('Only an admin can move a request back to an earlier stage')
  }

  return allow
}

/**
 * The statuses to offer in the dropdown. Empty means the actor cannot act on
 * this request at all, and the caller should explain why instead of rendering a
 * control that the server would reject.
 */
export function allowedNextStatuses(actor: Actor, request: Subject): RequestStatus[] {
  return REQUEST_STATUS_CANDIDATES.filter(
    (status) => status !== request.status && canChangeStatus(actor, request, status).ok,
  )
}

// `cancelled` last: it is an exit, not the step after `complete`.
const REQUEST_STATUS_CANDIDATES: RequestStatus[] = [...STATUS_PIPELINE, 'cancelled']

/**
 * Why the actor cannot move this request anywhere, or null if they can.
 *
 * Lets the UI replace a dead dropdown with an explanation instead of leaving the
 * user to guess.
 */
export function statusBlockReason(actor: Actor, request: Subject): string | null {
  if (allowedNextStatuses(actor, request).length > 0) return null

  // Probe a target the actor plausibly wanted, so the message names the real
  // obstacle — ownership, or the request already being finished.
  const probe = canChangeStatus(
    actor,
    request,
    request.status === 'complete' || request.status === 'cancelled' ? 'in_progress' : 'complete',
  )

  return probe.ok ? null : probe.reason
}

/* -------------------------------------------------------------------------- */
/* Assignment                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Admins place anyone; staff may only claim work nobody else holds, and only
 * for themselves. Releasing a claim is an admin action — otherwise a staff
 * member could drop a request mid-flight and lose the owner on the record.
 */
export function canAssign(actor: Actor, request: Subject, assigneeId: string | null): Permission {
  if (!isStaff(actor)) return deny('Your account is not active')
  if (isAdmin(actor)) return allow

  if (assigneeId === null) return deny('Only an admin can unassign a request')
  if (assigneeId !== actor.id) return deny('Only an admin can assign work to someone else')
  if (request.assigned_to === actor.id) return deny('This request is already yours')
  if (request.assigned_to) return deny('This request is assigned to someone else')

  return allow
}

/** True when the actor can take an unheld request for themselves. */
export function canClaim(actor: Actor, request: Subject): boolean {
  return !request.assigned_to && canAssign(actor, request, actor.id).ok
}

/* -------------------------------------------------------------------------- */
/* Profiles                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Only admins manage the team, and never their own row — demoting or
 * deactivating yourself can leave a project with no admin at all.
 */
export function canManageProfile(actor: Actor, profileId: string): Permission {
  if (!isAdmin(actor)) return deny('Only an admin can manage team members')
  if (profileId === actor.id) return deny('You cannot change your own role or access')
  return allow
}

/** Accounts are created by invitation only, and only an admin may send one. */
export function canInviteStaff(actor: Actor): Permission {
  if (!isAdmin(actor)) return deny('Only an admin can invite team members')
  return allow
}
