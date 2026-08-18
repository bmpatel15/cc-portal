import { getAdminClient } from '@/lib/supabase/admin'
import type { RequestDurationRow, RequestTimeEntryRow } from '@/lib/supabase/types'
import {
  DEFAULT_WINDOW,
  type AnalyticsFilters,
  type Granularity,
} from '@/lib/schemas/analytics'
import { CLOSED_STATUSES, REQUEST_STATUSES, TEAMS } from '@/lib/schemas/request'
import type { RequestStatus, Team } from '@/lib/schemas/request'
import { STATUS_LABELS, TEAM_LABELS } from '@/lib/schemas/labels'

import {
  bucketAll,
  buildPeriods,
  comparePeriods,
  hasEnoughHistory,
  periodKey,
  windowRange,
  type Period,
  type PeriodComparison,
} from './periods'
import { median, percentile, round1, share, sum, toDays, toHours } from './stats'

/**
 * Every figure the analytics dashboard shows.
 *
 * Reads come from the `request_durations` view (0003), never from
 * `listRequests()` — that helper caps at 200 rows, which would silently
 * under-report the moment the portal outgrew a single screen of history.
 *
 * The shape of the work is: pull every row once, then derive every metric in
 * memory. At portal scale that is a handful of round trips saved and a single
 * consistent snapshot; if this ever needs to serve six figures of requests, the
 * aggregation moves into SQL — the view is already the seam for that.
 */

/** Supabase caps a single response at 1000 rows regardless of `.limit()`. */
const PAGE_SIZE = 1000

/** Age buckets for open work, in days. */
const AGE_BUCKETS = [
  { key: 'fresh', label: '0–7 days', min: 0, max: 7 },
  { key: 'aging', label: '8–30 days', min: 7, max: 30 },
  { key: 'stale', label: 'Over 30 days', min: 30, max: Infinity },
] as const

export type AgeBucketKey = (typeof AGE_BUCKETS)[number]['key']

export interface CountSlice<T extends string> {
  key: T
  label: string
  count: number
  percent: number
}

export interface TurnaroundPoint {
  key: string
  label: string
  medianHours: number | null
  p90Hours: number | null
  sample: number
}

export interface TeamPeriodPoint {
  key: string
  label: string
  audio: number
  'photo-video': number
  'content-creation': number
}

export interface AnalyticsSnapshot {
  granularity: Granularity
  periods: Period[]
  range: { start: string; end: string } | null
  generatedAt: string

  /** Whether the whole dataset (not just the window) is too thin to trend. */
  hasHistory: boolean

  headline: {
    total: number
    prior: number | null
    change: number | null
  }

  volume: PeriodComparison[]
  teamByPeriod: TeamPeriodPoint[]
  turnaroundByPeriod: TurnaroundPoint[]

  statusMix: CountSlice<RequestStatus>[]
  teamMix: CountSlice<Team>[]
  departments: { department: string; count: number; percent: number }[]

  backlog: {
    open: number
    unassigned: number
    buckets: CountSlice<AgeBucketKey>[]
    oldestDays: number | null
  }

  durations: {
    medianTurnaroundHours: number | null
    p90TurnaroundHours: number | null
    medianPickupHours: number | null
    completedSample: number
    pickedUpSample: number
  }

  timeInStatus: { status: RequestStatus; totalHours: number; averageHours: number }[]

  leadTime: {
    medianDays: number | null
    sample: number
    /** Requests submitted after the event they refer to. */
    afterTheEvent: number
  }

  outcomes: {
    completed: number
    cancelled: number
    closed: number
    completionRate: number | null
  }

  logged: {
    totalHours: number
    requestsWithHours: number
    /** Requests in the window, i.e. the denominator for coverage. */
    totalRequests: number
  }

  effort: {
    team: Team
    label: string
    requests: number
    photographers: number
    videographers: number
    microphones: number
  }[]

  /** Distinct departments across all data, for the filter control. */
  allDepartments: string[]
}

/* -------------------------------------------------------------------------- */
/* Fetching                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Every duration row matching the non-date filters.
 *
 * Pages explicitly: PostgREST caps a response at 1000 rows whatever `.limit()`
 * says, so a single unpaged select would quietly truncate the moment the portal
 * passed a thousand requests — and an analytics page that under-reports without
 * erroring is worse than one that fails.
 */
async function fetchDurations(filters: AnalyticsFilters): Promise<RequestDurationRow[]> {
  const rows: RequestDurationRow[] = []

  for (let page = 0; ; page += 1) {
    let query = getAdminClient()
      .from('request_durations')
      .select('*')
      .order('created_at', { ascending: true })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)

    if (filters.team) query = query.eq('team', filters.team)
    if (filters.department) query = query.ilike('department', filters.department)

    const { data, error } = await query
    if (error) throw new Error(`Failed to load analytics: ${error.message}`)

    const batch = (data ?? []) as RequestDurationRow[]
    rows.push(...batch)

    if (batch.length < PAGE_SIZE) break
  }

  return rows
}

/** Distinct departments across all requests, for the filter control. */
async function fetchDepartments(): Promise<string[]> {
  const { data, error } = await getAdminClient().from('requests').select('department')
  if (error) throw new Error(`Failed to load departments: ${error.message}`)

  // `department` is free text, so the same team arrives spelled several ways.
  // Case-insensitive dedupe is the most we can do after the fact; fixing it
  // properly means a controlled list on the request form.
  const seen = new Map<string, string>()
  for (const row of (data ?? []) as { department: string }[]) {
    const trimmed = row.department?.trim()
    if (!trimmed) continue
    const key = trimmed.toLowerCase()
    if (!seen.has(key)) seen.set(key, trimmed)
  }

  return [...seen.values()].sort((a, b) => a.localeCompare(b))
}

/* -------------------------------------------------------------------------- */
/* Derivation                                                                 */
/* -------------------------------------------------------------------------- */

function numeric(value: number | string | null): number | null {
  if (value === null) return null
  const parsed = typeof value === 'string' ? Number(value) : value
  return Number.isFinite(parsed) ? parsed : null
}

/** A count from `details` jsonb, which is untyped and may hold anything. */
function detailCount(details: Record<string, unknown> | null, field: string): number {
  const raw = details?.[field]
  const parsed = typeof raw === 'string' ? Number(raw) : typeof raw === 'number' ? raw : 0
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0
}

export async function getAnalytics(filters: AnalyticsFilters): Promise<AnalyticsSnapshot> {
  const granularity = filters.granularity
  const windowSize = filters.window ?? DEFAULT_WINDOW[granularity]

  const [rows, allDepartments] = await Promise.all([fetchDurations(filters), fetchDepartments()])

  const now = new Date()
  const periods = buildPeriods(granularity, windowSize, now)
  const range = windowRange(periods)

  // The first request ever recorded, which is what separates "a quiet month"
  // from "a month before the portal existed" when computing comparisons.
  const earliest = rows.length > 0 ? new Date(rows[0].created_at) : null

  const windowStart = range?.start ?? null
  const inWindow = windowStart
    ? rows.filter((row) => new Date(row.created_at) >= windowStart)
    : rows

  /* Volume ---------------------------------------------------------------- */

  const allCounts = bucketAll(
    rows.map((row) => row.created_at),
    granularity,
  )
  const volume = comparePeriods(allCounts, periods, granularity, earliest)

  const headlineComparison = volume[volume.length - 1]

  /* Mixes ----------------------------------------------------------------- */

  const total = inWindow.length

  const statusMix = REQUEST_STATUSES.map((status) => {
    const count = inWindow.filter((row) => row.status === status).length
    return { key: status, label: STATUS_LABELS[status], count, percent: round1(share(count, total)) }
  })

  const teamMix = TEAMS.map((team) => {
    const count = inWindow.filter((row) => row.team === team).length
    return { key: team, label: TEAM_LABELS[team], count, percent: round1(share(count, total)) }
  })

  const departmentTotals = new Map<string, { label: string; count: number }>()
  for (const row of inWindow) {
    const trimmed = row.department?.trim()
    if (!trimmed) continue
    const key = trimmed.toLowerCase()
    const existing = departmentTotals.get(key)
    if (existing) existing.count += 1
    else departmentTotals.set(key, { label: trimmed, count: 1 })
  }

  const departments = [...departmentTotals.values()]
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .map((entry) => ({
      department: entry.label,
      count: entry.count,
      percent: round1(share(entry.count, total)),
    }))

  /* Team split per period ------------------------------------------------- */

  const teamByPeriod: TeamPeriodPoint[] = periods.map((period) => {
    const point: TeamPeriodPoint = {
      key: period.key,
      label: period.label,
      audio: 0,
      'photo-video': 0,
      'content-creation': 0,
    }

    for (const row of rows) {
      if (periodKey(new Date(row.created_at), granularity) === period.key) {
        point[row.team] += 1
      }
    }

    return point
  })

  /* Durations ------------------------------------------------------------- */

  const turnarounds = inWindow
    .map((row) => numeric(row.turnaround_seconds))
    .filter((value): value is number => value !== null)

  const pickups = inWindow
    .map((row) => numeric(row.time_to_pickup_seconds))
    .filter((value): value is number => value !== null)

  const medianTurnaround = median(turnarounds)
  const p90Turnaround = percentile(turnarounds, 0.9)
  const medianPickup = median(pickups)

  const turnaroundByPeriod: TurnaroundPoint[] = periods.map((period) => {
    // Bucketed by completion date, not submission: a request completed in
    // March describes March's performance even if it arrived in January.
    const values = rows
      .filter(
        (row) =>
          row.first_complete_at &&
          periodKey(new Date(row.first_complete_at), granularity) === period.key,
      )
      .map((row) => numeric(row.turnaround_seconds))
      .filter((value): value is number => value !== null)

    const periodMedian = median(values)
    const periodP90 = percentile(values, 0.9)

    return {
      key: period.key,
      label: period.label,
      medianHours: periodMedian === null ? null : round1(toHours(periodMedian)),
      p90Hours: periodP90 === null ? null : round1(toHours(periodP90)),
      sample: values.length,
    }
  })

  const timeInStatus = (['pending', 'in_progress', 'review'] as const).map((status) => {
    const field =
      status === 'pending'
        ? 'pending_seconds'
        : status === 'in_progress'
          ? 'in_progress_seconds'
          : 'review_seconds'

    const values = inWindow
      .map((row) => numeric(row[field] as number))
      .filter((value): value is number => value !== null && value > 0)

    const totalSeconds = sum(values)

    return {
      status: status as RequestStatus,
      totalHours: round1(toHours(totalSeconds)),
      averageHours: values.length ? round1(toHours(totalSeconds / values.length)) : 0,
    }
  })

  /* Backlog --------------------------------------------------------------- */

  const closed = new Set<string>(CLOSED_STATUSES)
  const open = rows.filter((row) => !closed.has(row.status))

  const ageDays = (row: RequestDurationRow) =>
    (now.getTime() - new Date(row.created_at).getTime()) / 86_400_000

  const backlogBuckets = AGE_BUCKETS.map((bucket) => {
    const count = open.filter((row) => {
      const age = ageDays(row)
      return age >= bucket.min && age < bucket.max
    }).length

    return {
      key: bucket.key,
      label: bucket.label,
      count,
      percent: round1(share(count, open.length)),
    }
  })

  const oldestDays = open.length ? round1(Math.max(...open.map(ageDays))) : null

  /* Lead time ------------------------------------------------------------- */

  const leadSeconds = inWindow
    .map((row) => numeric(row.lead_time_seconds))
    .filter((value): value is number => value !== null)

  const medianLead = median(leadSeconds)

  /* Outcomes -------------------------------------------------------------- */

  const completed = inWindow.filter((row) => row.status === 'complete').length
  const cancelled = inWindow.filter((row) => row.status === 'cancelled').length
  const closedCount = completed + cancelled

  /* Logged hours ---------------------------------------------------------- */

  const loggedHours = sum(
    inWindow.map((row) => numeric(row.logged_hours) ?? 0).filter((value) => value > 0),
  )
  const requestsWithHours = inWindow.filter((row) => (numeric(row.logged_hours) ?? 0) > 0).length

  /* Effort proxies -------------------------------------------------------- */

  const effort = summariseEffort(inWindow)

  return {
    granularity,
    periods,
    range: range
      ? { start: range.start.toISOString(), end: range.end.toISOString() }
      : null,
    generatedAt: now.toISOString(),
    hasHistory: hasEnoughHistory(allCounts),

    headline: {
      total,
      prior: headlineComparison?.prior ?? null,
      change: headlineComparison?.change ?? null,
    },

    volume,
    teamByPeriod,
    turnaroundByPeriod,

    statusMix,
    teamMix,
    departments,

    backlog: {
      open: open.length,
      unassigned: open.filter((row) => !row.assigned_to).length,
      buckets: backlogBuckets,
      oldestDays,
    },

    durations: {
      medianTurnaroundHours: medianTurnaround === null ? null : round1(toHours(medianTurnaround)),
      p90TurnaroundHours: p90Turnaround === null ? null : round1(toHours(p90Turnaround)),
      medianPickupHours: medianPickup === null ? null : round1(toHours(medianPickup)),
      completedSample: turnarounds.length,
      pickedUpSample: pickups.length,
    },

    timeInStatus,

    leadTime: {
      medianDays: medianLead === null ? null : round1(toDays(medianLead)),
      sample: leadSeconds.length,
      afterTheEvent: leadSeconds.filter((value) => value < 0).length,
    },

    outcomes: {
      completed,
      cancelled,
      closed: closedCount,
      completionRate: closedCount > 0 ? round1(share(completed, closedCount)) : null,
    },

    logged: {
      totalHours: round1(loggedHours),
      requestsWithHours,
      totalRequests: total,
    },

    effort,
    allDepartments,
  }
}

/**
 * Crew-size totals pulled from `details` jsonb.
 *
 * These are the only quantity fields the portal has ever collected, so they are
 * the closest thing to a workload measure that works retroactively. They are
 * requested crew, not confirmed crew, and the UI says so.
 *
 * Derived from rows already in hand rather than re-queried, so it inherits the
 * paging and filtering that got them here.
 */
function summariseEffort(rows: readonly RequestDurationRow[]): AnalyticsSnapshot['effort'] {
  const totals = new Map(
    TEAMS.map((team) => [
      team,
      {
        team,
        label: TEAM_LABELS[team],
        requests: 0,
        photographers: 0,
        videographers: 0,
        microphones: 0,
      },
    ]),
  )

  for (const row of rows) {
    const entry = totals.get(row.team)
    if (!entry) continue

    const details = row.details as unknown as Record<string, unknown> | null

    entry.requests += 1
    entry.photographers += detailCount(details, 'photographerCount')
    entry.videographers += detailCount(details, 'videographerCount')
    entry.microphones +=
      detailCount(details, 'handheldCount') +
      detailCount(details, 'headsetCount') +
      detailCount(details, 'wiredCount')
  }

  return [...totals.values()]
}

/* -------------------------------------------------------------------------- */
/* Rows for export                                                            */
/* -------------------------------------------------------------------------- */

/** The per-request rows behind the charts, for the CSV download. */
export async function listRequestDurations(
  filters: AnalyticsFilters,
): Promise<RequestDurationRow[]> {
  const rows = await fetchDurations(filters)
  const granularity = filters.granularity
  const windowSize = filters.window ?? DEFAULT_WINDOW[granularity]
  const range = windowRange(buildPeriods(granularity, windowSize, new Date()))

  if (!range) return rows
  return rows.filter((row) => new Date(row.created_at) >= range.start)
}

/* -------------------------------------------------------------------------- */
/* Logged time                                                                */
/* -------------------------------------------------------------------------- */

export async function listTimeEntries(requestId: string): Promise<RequestTimeEntryRow[]> {
  const { data, error } = await getAdminClient()
    .from('request_time_entries')
    .select('*')
    .eq('request_id', requestId)
    .order('worked_on', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) throw new Error(`Failed to load logged time: ${error.message}`)
  return (data ?? []) as RequestTimeEntryRow[]
}

export async function logTime(
  input: { requestId: string; hours: number; note?: string; workedOn?: string },
  staffId: string,
): Promise<void> {
  const { error } = await getAdminClient()
    .from('request_time_entries')
    .insert({
      request_id: input.requestId,
      staff_id: staffId,
      hours: input.hours,
      note: input.note ?? null,
      ...(input.workedOn ? { worked_on: input.workedOn } : {}),
    })

  if (error) throw new Error(`Failed to log time: ${error.message}`)
}

/**
 * Removes an entry, but only one the actor is entitled to remove.
 *
 * The ownership test is part of the delete rather than a prior read so there is
 * no window between checking and acting — a non-admin deleting someone else's
 * entry matches zero rows and changes nothing.
 */
export async function deleteTimeEntry(
  entryId: string,
  actor: { id: string; role: string },
): Promise<boolean> {
  let query = getAdminClient().from('request_time_entries').delete().eq('id', entryId)
  if (actor.role !== 'admin') query = query.eq('staff_id', actor.id)

  const { data, error } = await query.select('id')
  if (error) throw new Error(`Failed to remove the entry: ${error.message}`)

  return (data ?? []).length > 0
}
