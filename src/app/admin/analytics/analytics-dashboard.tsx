'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { format } from 'date-fns'
import { ArrowLeft, Download, FileText, Loader2, Minus, TrendingDown, TrendingUp } from 'lucide-react'
import { toast } from 'sonner'

import { FilterChip } from '@/components/filter-chip'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { GRANULARITY_NOUN } from '@/lib/analytics/periods'
import type { AnalyticsSnapshot } from '@/lib/analytics/service'
import { GRANULARITIES, type AnalyticsFilters, type Granularity } from '@/lib/schemas/analytics'
import { STATUS_LABELS, TEAM_LABELS } from '@/lib/schemas/labels'
import { TEAMS } from '@/lib/schemas/request'
import { cn } from '@/lib/utils'

import {
  ChartEmpty,
  DepartmentChart,
  StatusMixChart,
  TeamMixChart,
  TimeInStatusChart,
  TurnaroundChart,
  VolumeChart,
} from './analytics-charts'

/**
 * The analytics shell: filters, headline tiles, and the charts.
 *
 * Filter state lives in the URL rather than in React state, so the server
 * recomputes on change and — more importantly — the CSV link is just the
 * current query string pointed at the export route. A download can therefore
 * never disagree with what is on screen, which is the failure mode that makes
 * people stop trusting a dashboard.
 */

const GRANULARITY_LABELS: Record<Granularity, string> = {
  month: 'Monthly',
  quarter: 'Quarterly',
  year: 'Yearly',
}

export function AnalyticsDashboard({
  snapshot,
  filters,
}: {
  snapshot: AnalyticsSnapshot
  filters: AnalyticsFilters
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [pending, startTransition] = React.useTransition()
  const [exporting, setExporting] = React.useState(false)

  const setParam = React.useCallback(
    (key: string, value: string | null) => {
      const params = new URLSearchParams(searchParams.toString())
      if (value === null) params.delete(key)
      else params.set(key, value)

      startTransition(() => router.push(`/admin/analytics?${params.toString()}`))
    },
    [router, searchParams],
  )

  const noun = GRANULARITY_NOUN[snapshot.granularity]
  const exportHref = `/api/admin/analytics/export?${searchParams.toString()}`

  const onExportPdf = React.useCallback(async () => {
    setExporting(true)
    try {
      const { exportDashboardPdf } = await import('@/lib/analytics/pdf')
      await exportDashboardPdf(snapshot)
      toast.success('Report downloaded')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not build the report')
    } finally {
      setExporting(false)
    }
  }, [snapshot])

  return (
    <div className={cn('space-y-5', pending && 'opacity-60 transition-opacity')}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Button asChild variant="ghost" size="sm" className="-ml-2">
            <Link href="/admin">
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to the dashboard
            </Link>
          </Button>
          <h1 className="mt-1 text-xl font-semibold">Analytics</h1>
          <p className="text-sm text-muted-foreground">
            {snapshot.range
              ? `${format(new Date(snapshot.range.start), 'MMM yyyy')} – ${format(
                  new Date(snapshot.range.end),
                  'MMM yyyy',
                )}`
              : 'No range'}
            {' · '}
            {snapshot.headline.total} request{snapshot.headline.total === 1 ? '' : 's'}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <a href={exportHref}>
              <Download className="h-4 w-4" />
              CSV
            </a>
          </Button>
          <Button variant="outline" size="sm" onClick={onExportPdf} disabled={exporting}>
            {exporting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileText className="h-4 w-4" />
            )}
            PDF report
          </Button>
        </div>
      </div>

      {/* Filters ------------------------------------------------------- */}
      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-xs font-medium text-muted-foreground">Group by</span>
            {GRANULARITIES.map((value) => (
              <FilterChip
                key={value}
                active={snapshot.granularity === value}
                onClick={() => setParam('granularity', value)}
              >
                {GRANULARITY_LABELS[value]}
              </FilterChip>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-xs font-medium text-muted-foreground">Team</span>
            <FilterChip active={!filters.team} onClick={() => setParam('team', null)}>
              All teams
            </FilterChip>
            {TEAMS.map((team) => (
              <FilterChip
                key={team}
                active={filters.team === team}
                onClick={() => setParam('team', team)}
              >
                {TEAM_LABELS[team]}
              </FilterChip>
            ))}
          </div>

          {snapshot.allDepartments.length > 0 ? (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="mr-1 text-xs font-medium text-muted-foreground">Department</span>
              <FilterChip
                active={!filters.department}
                onClick={() => setParam('department', null)}
              >
                All
              </FilterChip>
              {snapshot.allDepartments.map((department) => (
                <FilterChip
                  key={department}
                  active={filters.department?.toLowerCase() === department.toLowerCase()}
                  onClick={() => setParam('department', department)}
                >
                  {department}
                </FilterChip>
              ))}
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* Headline tiles ------------------------------------------------ */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label={`Requests this ${noun}`}
          value={snapshot.volume[snapshot.volume.length - 1]?.current ?? 0}
          delta={snapshot.volume[snapshot.volume.length - 1]?.change ?? null}
          hint={
            snapshot.volume[snapshot.volume.length - 1]?.prior === null
              ? `No prior ${noun} to compare`
              : `vs ${snapshot.volume[snapshot.volume.length - 1]?.prior} last ${noun}`
          }
        />
        <StatTile
          label="Median turnaround"
          value={
            snapshot.durations.medianTurnaroundHours === null
              ? '—'
              : `${snapshot.durations.medianTurnaroundHours} h`
          }
          hint={
            snapshot.durations.completedSample === 0
              ? 'No completed requests yet'
              : `p90 ${snapshot.durations.p90TurnaroundHours} h · ${snapshot.durations.completedSample} completed`
          }
        />
        <StatTile
          label="Open backlog"
          value={snapshot.backlog.open}
          hint={
            snapshot.backlog.open === 0
              ? 'Nothing outstanding'
              : `${snapshot.backlog.unassigned} unassigned · oldest ${snapshot.backlog.oldestDays} d`
          }
        />
        <StatTile
          label="Completion rate"
          value={
            snapshot.outcomes.completionRate === null
              ? '—'
              : `${snapshot.outcomes.completionRate}%`
          }
          hint={
            snapshot.outcomes.closed === 0
              ? 'Nothing closed yet'
              : `${snapshot.outcomes.completed} complete · ${snapshot.outcomes.cancelled} cancelled`
          }
        />
      </div>

      {/* Volume -------------------------------------------------------- */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Requests over time</CardTitle>
          <CardDescription>
            Submissions per {noun}, by the date the request came in.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {snapshot.hasHistory ? (
            <VolumeChart data={snapshot.volume} />
          ) : (
            <ChartEmpty
              message={`Requests need to span more than one ${noun} before a trend means anything. This fills in on its own.`}
            />
          )}
        </CardContent>
      </Card>

      {/* Period comparison table --------------------------------------- */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {GRANULARITY_LABELS[snapshot.granularity]} comparison
          </CardTitle>
          <CardDescription>
            Each {noun} against the one before it. A blank comparison means there was no prior{' '}
            {noun} on record — not that it was zero.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Period</TableHead>
                <TableHead className="text-right">Requests</TableHead>
                <TableHead className="text-right">Prior</TableHead>
                <TableHead className="text-right">Change</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...snapshot.volume].reverse().map((entry) => (
                <TableRow key={entry.period.key}>
                  <TableCell className="font-medium">{entry.period.label}</TableCell>
                  <TableCell className="text-right tabular-nums">{entry.current}</TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {entry.prior === null ? '—' : entry.prior}
                  </TableCell>
                  <TableCell className="text-right">
                    <DeltaChip
                      change={entry.change}
                      fallback={entry.prior === null ? `No prior ${noun}` : 'No change'}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Mix ----------------------------------------------------------- */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Team split</CardTitle>
            <CardDescription>Which team each {noun}&apos;s work went to.</CardDescription>
          </CardHeader>
          <CardContent>
            {snapshot.hasHistory ? (
              <TeamMixChart data={snapshot.teamByPeriod} />
            ) : (
              <ChartEmpty message="Once requests span more than one period this shows how the mix shifts." />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Status mix</CardTitle>
            <CardDescription>Where the requests in this range currently stand.</CardDescription>
          </CardHeader>
          <CardContent>
            <StatusMixChart data={snapshot.statusMix} />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Busiest departments</CardTitle>
            <CardDescription>
              Top ten by request count. Department is free text on the request form, so near
              duplicates are grouped only where the spelling matches.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DepartmentChart data={snapshot.departments} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Turnaround</CardTitle>
            <CardDescription>
              Submission to first completion, by the {noun} the work finished. Elapsed time, not
              hours worked.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {snapshot.durations.completedSample > 0 ? (
              <TurnaroundChart data={snapshot.turnaroundByPeriod} />
            ) : (
              <ChartEmpty message="Nothing has been completed in this range yet, so there is no turnaround to measure." />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Where time goes ----------------------------------------------- */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Where requests wait</CardTitle>
            <CardDescription>
              Total elapsed time spent in each stage. Finished requests stop accruing time.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <TimeInStatusChart
              data={snapshot.timeInStatus.map((entry) => ({
                label: STATUS_LABELS[entry.status],
                totalHours: entry.totalHours,
              }))}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Backlog age</CardTitle>
            <CardDescription>How long the currently open requests have been waiting.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {snapshot.backlog.open === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Nothing is outstanding.
              </p>
            ) : (
              snapshot.backlog.buckets.map((bucket) => (
                <div key={bucket.key} className="space-y-1">
                  <div className="flex items-baseline justify-between text-sm">
                    <span>{bucket.label}</span>
                    <span className="font-medium tabular-nums">{bucket.count}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${bucket.percent}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Effort -------------------------------------------------------- */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Logged hours</CardTitle>
            <CardDescription>
              Hours staff recorded against requests. Separate from turnaround above, which is
              elapsed time — the two are never added together.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tabular-nums">
              {snapshot.logged.totalHours} h
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {snapshot.logged.requestsWithHours === 0
                ? 'No hours logged in this range yet. Staff can log time from a request.'
                : `${snapshot.logged.requestsWithHours} of ${snapshot.logged.totalRequests} requests have logged hours — the total covers only those.`}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Crew requested</CardTitle>
            <CardDescription>
              Totals from the request form. This is crew asked for, not crew confirmed.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Team</TableHead>
                  <TableHead className="text-right">Requests</TableHead>
                  <TableHead className="text-right">Crew</TableHead>
                  <TableHead className="text-right">Mics</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {snapshot.effort.map((entry) => (
                  <TableRow key={entry.team}>
                    <TableCell className="font-medium">{entry.label}</TableCell>
                    <TableCell className="text-right tabular-nums">{entry.requests}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {entry.photographers + entry.videographers || '—'}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {entry.microphones || '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Lead time ------------------------------------------------------ */}
      <Card>
        <CardContent className="grid gap-4 p-4 sm:grid-cols-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Median notice given
            </p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">
              {snapshot.leadTime.medianDays === null ? '—' : `${snapshot.leadTime.medianDays} d`}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Between a request arriving and the event it is for.
            </p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Median time to pick up
            </p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">
              {snapshot.durations.medianPickupHours === null
                ? '—'
                : `${snapshot.durations.medianPickupHours} h`}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              How long a request waits before someone starts it.
            </p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Submitted after the event
            </p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">
              {snapshot.leadTime.afterTheEvent}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Requests whose event date had already passed.
            </p>
          </div>
        </CardContent>
      </Card>

      <p className="text-center text-xs text-muted-foreground">
        Generated {format(new Date(snapshot.generatedAt), "d MMM yyyy 'at' h:mm a")}. Per-person
        history is not shown — assignment changes are not recorded, so only current ownership is
        known.
      </p>
    </div>
  )
}

function StatTile({
  label,
  value,
  hint,
  delta,
}: {
  label: string
  value: React.ReactNode
  hint?: string
  delta?: number | null
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <div className="mt-1 flex items-baseline gap-2">
          <p className="text-2xl font-semibold tabular-nums">{value}</p>
          {delta !== undefined ? <DeltaChip change={delta} fallback={null} /> : null}
        </div>
        {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
      </CardContent>
    </Card>
  )
}

/**
 * A change indicator that refuses to invent one.
 *
 * `change` is null whenever there is no baseline — a portal in its first month
 * has not grown infinitely, it simply has nothing to be compared with — so the
 * chip falls back to plain text rather than a green arrow.
 */
function DeltaChip({ change, fallback }: { change: number | null; fallback: string | null }) {
  if (change === null) {
    return fallback ? <span className="text-xs text-muted-foreground">{fallback}</span> : null
  }

  const rounded = Math.round(change)
  const Icon = rounded > 0 ? TrendingUp : rounded < 0 ? TrendingDown : Minus

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
        rounded > 0 && 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
        rounded < 0 && 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
        rounded === 0 && 'bg-muted text-muted-foreground',
      )}
    >
      <Icon className="h-3 w-3" />
      {rounded > 0 ? '+' : ''}
      {rounded}%
    </span>
  )
}
