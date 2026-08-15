import type { RequestDetails, RequestStatus, Team } from '@/lib/schemas/request'

/**
 * Hand-maintained mirror of supabase/migrations/0001_init.sql.
 * Keep in sync with the migration when columns change.
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
  created_at: string
}

/** A request with everything the tracking page and admin drawer need. */
export interface RequestWithRelations extends RequestRow {
  request_files: RequestFileRow[]
  request_status_history: RequestStatusHistoryRow[]
}
