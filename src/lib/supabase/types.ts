import type { RequestDetails, RequestStatus, Team } from '@/lib/schemas/request'

/**
 * Hand-maintained mirror of supabase/migrations/*.sql.
 * Keep in sync with the migrations when columns change.
 */

export type NotificationChannel = 'email' | 'telegram'
export type NotificationStatus = 'pending' | 'sent' | 'failed'
export type UserRole = 'admin' | 'staff'

export interface RequestRow {
  id: string
  tracking_token: string
  full_name: string
  email: string
  phone: string | null
  department: string
  event_name: string
  event_datetime: string
  team: Team
  details: RequestDetails
  status: RequestStatus
  assigned_to: string | null
  created_at: string
  updated_at: string
}

export interface RequestFileRow {
  id: string
  request_id: string
  name: string
  storage_path: string
  url: string
  size_bytes: number
  content_type: string
  created_at: string
}

export interface RequestStatusHistoryRow {
  id: string
  request_id: string
  from_status: RequestStatus | null
  to_status: RequestStatus
  note: string | null
  changed_by: string | null
  created_at: string
}

export interface NotificationRow {
  id: string
  request_id: string
  channel: NotificationChannel
  template: string
  recipient: string
  payload: Record<string, unknown>
  status: NotificationStatus
  attempts: number
  last_error: string | null
  sent_at: string | null
  created_at: string
  updated_at: string
}

export interface ProfileRow {
  id: string
  email: string
  full_name: string | null
  role: UserRole
  is_active: boolean
  created_at: string
}

export interface RequestTimeEntryRow {
  id: string
  request_id: string
  staff_id: string | null
  hours: number
  note: string | null
  worked_on: string
  created_at: string
}

/**
 * A row of `public.request_durations` (0003).
 *
 * Every `*_seconds` field is derived, never stored: the view recomputes them
 * from `request_status_history` on read. Nulls are meaningful — a null
 * `turnaround_seconds` means the request has not completed, not that it took no
 * time — so callers must filter rather than coalesce to zero.
 */
export interface RequestDurationRow {
  id: string
  created_at: string
  event_datetime: string
  team: Team
  department: string
  status: RequestStatus
  assigned_to: string | null
  event_name: string
  details: RequestDetails

  first_pickup_at: string | null
  first_complete_at: string | null
  first_cancelled_at: string | null
  transition_count: number

  pending_seconds: number
  in_progress_seconds: number
  review_seconds: number

  time_to_pickup_seconds: number | null
  turnaround_seconds: number | null
  lead_time_seconds: number

  logged_hours: number | null
  time_entry_count: number
}

/** Just enough of a profile to name someone in the UI. */
export type ProfileSummary = Pick<ProfileRow, 'id' | 'email' | 'full_name'>

/** A request with everything the tracking page and admin drawer need. */
export interface RequestWithRelations extends RequestRow {
  request_files: RequestFileRow[]
  request_status_history: RequestStatusHistoryRow[]
  assignee: ProfileSummary | null

  /**
   * Only present on the staff paths. The public tracking page selects without
   * it, so it is optional rather than an empty array — absent means "not
   * loaded here", which is different from "none logged".
   */
  request_time_entries?: RequestTimeEntryRow[]
}
