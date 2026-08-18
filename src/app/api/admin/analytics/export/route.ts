import { NextResponse, type NextRequest } from 'next/server'
import { format } from 'date-fns'

import { filenameSlug, toCsv, UTF8_BOM } from '@/lib/analytics/csv'
import { getAnalytics, listRequestDurations } from '@/lib/analytics/service'
import { roundedHours, round1, toDays } from '@/lib/analytics/stats'
import { exportQuerySchema } from '@/lib/schemas/analytics'
import { STATUS_LABELS, TEAM_LABELS } from '@/lib/schemas/labels'
import { getCurrentProfile } from '@/lib/supabase/server'

/**
 * CSV download of the figures behind the analytics page.
 *
 * The first authenticated route handler in the app — the others are either
 * public (submission, signed uploads) or bearer-secret (cron). It gates the
 * same way pages do, through the cookie-backed session, and refuses before
 * touching data rather than filtering afterwards.
 */

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const profile = await getCurrentProfile()
  if (!profile || !profile.is_active) {
    return NextResponse.json({ success: false, message: 'Not signed in' }, { status: 401 })
  }
  if (profile.role !== 'admin') {
    return NextResponse.json({ success: false, message: 'Admins only' }, { status: 403 })
  }

  const parsed = exportQuerySchema.safeParse(
    Object.fromEntries(request.nextUrl.searchParams.entries()),
  )
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, message: parsed.error.issues[0]?.message ?? 'Invalid filters' },
      { status: 422 },
    )
  }

  const filters = parsed.data

  try {
    const { headers, rows, name } =
      filters.dataset === 'summary'
        ? await summaryCsv(filters)
        : await requestsCsv(filters)

    const body = UTF8_BOM + toCsv(headers, rows)
    const filename = `${filenameSlug([
      'cc-portal',
      name,
      filters.team,
      filters.department,
      format(new Date(), 'yyyy-MM-dd'),
    ])}.csv`

    return new NextResponse(body, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Could not build the export',
      },
      { status: 500 },
    )
  }
}

/** One row per request, with every derived duration spelled out. */
async function requestsCsv(filters: Parameters<typeof listRequestDurations>[0]) {
  const rows = await listRequestDurations(filters)

  const headers = [
    'Request ID',
    'Submitted',
    'Event',
    'Event date',
    'Team',
    'Department',
    'Status',
    'Notice given (days)',
    'Time to pick up (hours)',
    'Turnaround (hours)',
    'Time pending (hours)',
    'Time in progress (hours)',
    'Time in review (hours)',
    'Logged hours',
    'Time entries',
    'Status changes',
  ]

  const body = rows.map((row) => [
    row.id,
    row.created_at,
    row.event_name,
    row.event_datetime,
    TEAM_LABELS[row.team] ?? row.team,
    row.department,
    STATUS_LABELS[row.status] ?? row.status,
    row.lead_time_seconds === null ? '' : round1(toDays(Number(row.lead_time_seconds))),
    roundedHours(row.time_to_pickup_seconds === null ? null : Number(row.time_to_pickup_seconds)),
    roundedHours(row.turnaround_seconds === null ? null : Number(row.turnaround_seconds)),
    roundedHours(Number(row.pending_seconds)),
    roundedHours(Number(row.in_progress_seconds)),
    roundedHours(Number(row.review_seconds)),
    row.logged_hours === null ? '' : Number(row.logged_hours),
    row.time_entry_count,
    row.transition_count,
  ])

  return { headers, rows: body, name: 'requests' }
}

/** The aggregated period table behind the charts. */
async function summaryCsv(filters: Parameters<typeof getAnalytics>[0]) {
  const snapshot = await getAnalytics(filters)

  const headers = [
    'Period',
    'Requests',
    'Prior period',
    'Change (%)',
    'Median turnaround (hours)',
    'p90 turnaround (hours)',
    'Completed in period',
  ]

  const turnaroundByKey = new Map(
    snapshot.turnaroundByPeriod.map((entry) => [entry.key, entry]),
  )

  const rows = snapshot.volume.map((entry) => {
    const turnaround = turnaroundByKey.get(entry.period.key)
    return [
      entry.period.label,
      entry.current,
      // Blank, not zero: a missing baseline is unknown, not empty.
      entry.prior === null ? '' : entry.prior,
      entry.change === null ? '' : round1(entry.change),
      turnaround?.medianHours ?? '',
      turnaround?.p90Hours ?? '',
      turnaround?.sample ?? 0,
    ]
  })

  return { headers, rows, name: 'summary' }
}
