import { getAdminClient } from '@/lib/supabase/admin'
import type {
  RequestFileRow,
  RequestRow,
  RequestStatusHistoryRow,
  RequestWithRelations,
} from '@/lib/supabase/types'
import type { RequestInput, RequestStatus } from '@/lib/schemas/request'
import {
  buildStaffNotification,
  buildStaffTelegramMessage,
  buildStatusChangeNotification,
  buildSubmitterConfirmation,
  type NotificationContext,
} from '@/lib/notifications/templates'
import { queueAndDeliver, type QueuedNotification } from '@/lib/notifications/dispatch'
import { staffEmailRecipient } from '@/lib/notifications/email'
import { telegramRecipient } from '@/lib/notifications/telegram'
import { canAssign, canChangeStatus, type Actor } from '@/lib/requests/permissions'
import { adminRequestUrl, fileUrl, trackingUrl } from '@/lib/urls'

/**
 * Persistence first, delivery second.
 *
 * `createRequest` returns as soon as the request is durably stored. Notification
 * failures are recorded in `notification_log` and retried later; they can no
 * longer destroy a submission the way the old fire-and-forget route did.
 */

const REQUEST_SELECT = `
  *,
  request_files (*),
  request_status_history (*),
  assignee:profiles!requests_assigned_to_fkey (id, email, full_name)
`

/**
 * The staff view of a request, which additionally carries logged time.
 *
 * Deliberately separate from `REQUEST_SELECT`: that one also serves
 * `getRequestByToken`, which backs the public tracking page. Logged hours are
 * internal — how long a job took the team is not something a requester is
 * shown — so they are only ever selected on the paths behind the login.
 */
const STAFF_REQUEST_SELECT = `
  ${REQUEST_SELECT},
  request_time_entries (*)
`

/**
 * `fileToken` decides which audience the attachment links are built for: the
 * requester needs their tracking token in the URL, staff are authorised by their
 * session and get a bare link. The same file therefore appears as two different
 * URLs in two different emails, which is why the link is built here rather than
 * stored on the row.
 */
function toContext(
  request: RequestRow,
  files: Pick<RequestFileRow, 'id' | 'name'>[],
  url: string,
  fileToken?: string | null,
): NotificationContext {
  return {
    id: request.id,
    fullName: request.full_name,
    email: request.email,
    phone: request.phone,
    department: request.department,
    eventName: request.event_name,
    eventDateTime: request.event_datetime,
    team: request.team,
    details: request.details,
    files: files.map((file) => ({ name: file.name, url: fileUrl(file.id, fileToken) })),
    trackingUrl: url,
  }
}

export interface CreatedRequest {
  id: string
  trackingToken: string
  trackingUrl: string
}

export async function createRequest(input: RequestInput): Promise<CreatedRequest> {
  const supabase = getAdminClient()

  const { data: inserted, error: insertError } = await supabase
    .from('requests')
    .insert({
      full_name: input.fullName,
      email: input.email,
      phone: input.phone || null,
      department: input.department,
      event_name: input.eventName,
      event_datetime: new Date(input.eventDateTime).toISOString(),
      team: input.team,
      details: input.details,
      status: 'pending',
    })
    .select()
    .single()

  if (insertError || !inserted) {
    throw new Error(`Failed to save request: ${insertError?.message ?? 'unknown error'}`)
  }

  const request = inserted as RequestRow

  // Files were already uploaded to storage via signed URLs; record them.
  //
  // The rows are read back because the link is derived from the database-issued
  // id: nothing can address an attachment until it has one. `url` is left unset
  // -- see 0005_private_file_access.sql.
  let fileRows: Pick<RequestFileRow, 'id' | 'name'>[] = []

  if (input.files.length > 0) {
    const { data: insertedFiles, error: filesError } = await supabase
      .from('request_files')
      .insert(
        input.files.map((file) => ({
          request_id: request.id,
          name: file.name,
          storage_path: file.path,
          size_bytes: file.size,
          content_type: file.contentType,
        })),
      )
      .select('id, name')

    if (filesError) {
      // The request itself is saved; surface the problem without losing it. The
      // notifications then simply carry no attachment list, as before.
      console.error(`Failed to record files for request ${request.id}:`, filesError.message)
    }

    fileRows = (insertedFiles ?? []) as Pick<RequestFileRow, 'id' | 'name'>[]
  }

  const { error: historyError } = await supabase.from('request_status_history').insert({
    request_id: request.id,
    from_status: null,
    to_status: 'pending',
    note: 'Request submitted',
  })

  if (historyError) {
    console.error(`Failed to record initial history for ${request.id}:`, historyError.message)
  }

  const url = trackingUrl(request.tracking_token)

  const staffContext = toContext(request, fileRows, adminRequestUrl(request.id))
  const submitterContext = toContext(request, fileRows, url, request.tracking_token)

  const staffEmail = buildStaffNotification(staffContext)
  const confirmation = buildSubmitterConfirmation(submitterContext)

  const notifications: QueuedNotification[] = [
    {
      requestId: request.id,
      channel: 'telegram',
      template: 'staff_new_request',
      recipient: telegramRecipient(),
      payload: { text: buildStaffTelegramMessage(staffContext) },
    },
    {
      requestId: request.id,
      channel: 'email',
      template: 'staff_new_request',
      recipient: staffEmailRecipient(),
      payload: staffEmail,
    },
    {
      requestId: request.id,
      channel: 'email',
      template: 'submitter_confirmation',
      recipient: request.email,
      payload: confirmation,
    },
  ]

  await queueAndDeliver(notifications)

  return { id: request.id, trackingToken: request.tracking_token, trackingUrl: url }
}

/* -------------------------------------------------------------------------- */
/* Reads                                                                      */
/* -------------------------------------------------------------------------- */

function sortRelations(request: RequestWithRelations): RequestWithRelations {
  return {
    ...request,
    request_files: [...(request.request_files ?? [])].sort((a, b) =>
      a.created_at.localeCompare(b.created_at),
    ),
    request_status_history: [...(request.request_status_history ?? [])].sort((a, b) =>
      a.created_at.localeCompare(b.created_at),
    ),
  }
}

/** Token lookup runs with the service role so no anon policy exposes tracking_token. */
export async function getRequestByToken(token: string): Promise<RequestWithRelations | null> {
  if (!/^[0-9a-f-]{36}$/i.test(token)) return null

  const { data, error } = await getAdminClient()
    .from('requests')
    .select(REQUEST_SELECT)
    .eq('tracking_token', token)
    .maybeSingle()

  if (error || !data) return null
  return sortRelations(data as RequestWithRelations)
}

export async function getRequestById(id: string): Promise<RequestWithRelations | null> {
  const { data, error } = await getAdminClient()
    .from('requests')
    .select(REQUEST_SELECT)
    .eq('id', id)
    .maybeSingle()

  if (error || !data) return null
  return sortRelations(data as RequestWithRelations)
}

export interface ListFilters {
  status?: RequestStatus
  team?: string
  search?: string
}

/** Supabase caps a single response at 1000 rows regardless of `.limit()`. */
const PAGE_SIZE = 1000

/**
 * How many requests the board will load.
 *
 * The board counts, filters and searches entirely in memory, so it needs the
 * whole set for its numbers to be true. A ceiling still bounds the payload --
 * each row carries its files, history and time entries -- but past it the board
 * is *told* it is looking at a slice, instead of reporting the newest few
 * hundred as though they were everything.
 */
const BOARD_LIMIT = 2000

export interface RequestList {
  requests: RequestWithRelations[]
  /** More requests exist than were loaded, so any total shown is a floor. */
  truncated: boolean
  /** How many match the filters in total, whether or not they were loaded. */
  total: number
}

export async function listRequests(filters: ListFilters = {}): Promise<RequestList> {
  const requests: RequestWithRelations[] = []
  let total = 0

  for (let page = 0; page * PAGE_SIZE < BOARD_LIMIT; page += 1) {
    // The count comes back with the first page only; asking on every page would
    // repeat the same scan for an answer that cannot change mid-read.
    let query = getAdminClient()
      .from('requests')
      .select(STAFF_REQUEST_SELECT, page === 0 ? { count: 'exact' } : {})
      .order('created_at', { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)

    if (filters.status) query = query.eq('status', filters.status)
    if (filters.team) query = query.eq('team', filters.team)
    if (filters.search) {
      // PostgREST parses `or=(...)` as a comma-separated list of conditions, so
      // a raw term containing `,` or `)` closes this filter and appends
      // conditions of the caller's choosing -- `x,status.eq.complete` would
      // quietly change which rows come back. Double-quoting makes the value a
      // literal, and the backslash escapes let a quote inside the term stay data.
      const term = filters.search.replaceAll('\\', '\\\\').replaceAll('"', '\\"')
      const like = `"%${term}%"`

      query = query.or(
        `event_name.ilike.${like},full_name.ilike.${like},email.ilike.${like},department.ilike.${like}`,
      )
    }

    const { data, error, count } = await query
    if (error) throw new Error(`Failed to load requests: ${error.message}`)

    if (page === 0) total = count ?? 0

    const batch = (data ?? []) as RequestWithRelations[]
    requests.push(...batch)

    if (batch.length < PAGE_SIZE) break
  }

  return {
    requests: requests.map(sortRelations),
    truncated: total > requests.length,
    total,
  }
}

/**
 * One request with everything the dashboard shows, by id.
 *
 * Separate from `getRequestById`, which serves the tracking page and
 * deliberately leaves out logged time.
 */
export async function getStaffRequestById(id: string): Promise<RequestWithRelations | null> {
  const { data, error } = await getAdminClient()
    .from('requests')
    .select(STAFF_REQUEST_SELECT)
    .eq('id', id)
    .maybeSingle()

  if (error || !data) return null
  return sortRelations(data as RequestWithRelations)
}

export async function getRequestCounts(): Promise<Record<RequestStatus, number>> {
  const { data, error } = await getAdminClient().from('requests').select('status')
  if (error) throw new Error(`Failed to load counts: ${error.message}`)

  const counts: Record<RequestStatus, number> = {
    pending: 0,
    in_progress: 0,
    review: 0,
    complete: 0,
    cancelled: 0,
  }

  for (const row of (data ?? []) as { status: RequestStatus }[]) {
    counts[row.status] += 1
  }

  return counts
}

/* -------------------------------------------------------------------------- */
/* Status transitions                                                         */
/* -------------------------------------------------------------------------- */

/**
 * The permission check lives here rather than in the server action so that it
 * runs against the row actually being written — the caller's copy of the request
 * may be stale, and the admin client bypasses RLS, so this is the only gate.
 */
export async function updateRequestStatus(
  requestId: string,
  status: RequestStatus,
  note: string | undefined,
  actor: Actor,
): Promise<RequestStatusHistoryRow | null> {
  const supabase = getAdminClient()

  const existing = await getRequestById(requestId)
  if (!existing) throw new Error('Request not found')
  if (existing.status === status) return null

  const permitted = canChangeStatus(actor, existing, status)
  if (!permitted.ok) throw new Error(permitted.reason)

  const { error: updateError } = await supabase
    .from('requests')
    .update({ status })
    .eq('id', requestId)

  if (updateError) throw new Error(`Failed to update status: ${updateError.message}`)

  const { data: history, error: historyError } = await supabase
    .from('request_status_history')
    .insert({
      request_id: requestId,
      from_status: existing.status,
      to_status: status,
      note: note || null,
      changed_by: actor.id,
    })
    .select()
    .single()

  if (historyError) {
    console.error(`Failed to record status history for ${requestId}:`, historyError.message)
  }

  const url = trackingUrl(existing.tracking_token)
  const context = toContext(existing, existing.request_files ?? [], url, existing.tracking_token)
  const message = buildStatusChangeNotification(context, existing.status, status, note)

  await queueAndDeliver([
    {
      requestId,
      channel: 'email',
      template: 'submitter_status_change',
      recipient: existing.email,
      payload: message,
    },
  ])

  return (history as RequestStatusHistoryRow) ?? null
}

/* -------------------------------------------------------------------------- */
/* Assignment                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Give a request an owner, or clear it with `assigneeId: null`.
 *
 * Nothing is emailed: assignment is internal, and the requester's timeline
 * tracks stages rather than staffing. The `requests_touch_updated_at` trigger
 * moves `updated_at` for us.
 */
export async function assignRequest(
  requestId: string,
  assigneeId: string | null,
  actor: Actor,
): Promise<void> {
  const existing = await getRequestById(requestId)
  if (!existing) throw new Error('Request not found')
  if (existing.assigned_to === assigneeId) return

  const permitted = canAssign(actor, existing, assigneeId)
  if (!permitted.ok) throw new Error(permitted.reason)

  const { error } = await getAdminClient()
    .from('requests')
    .update({ assigned_to: assigneeId })
    .eq('id', requestId)

  if (error) throw new Error(`Failed to assign the request: ${error.message}`)
}
