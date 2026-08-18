import {
  addMonths,
  addQuarters,
  addYears,
  format,
  getQuarter,
  startOfMonth,
  startOfQuarter,
  startOfYear,
} from 'date-fns'

import type { Granularity } from '@/lib/schemas/analytics'

/**
 * Period bucketing and prior-period comparison.
 *
 * Deliberately pure and database-free: the duration arithmetic lives in SQL
 * (see the `request_durations` view), and everything here is calendar maths
 * that is far easier to reason about — and to check by hand — in one place.
 *
 * The rule this module exists to enforce: a comparison is only ever shown when
 * a real prior period exists to compare against. A portal that launched last
 * month must say "no prior month" rather than "+100%", which is why
 * `percentChange` returns null instead of a number when the baseline is empty.
 */

export interface Period {
  /** Sortable and stable: '2026-08', '2026-Q3', '2026'. */
  key: string
  label: string
  start: Date
  /** Exclusive — the start of the next period. */
  end: Date
}

const startOfPeriod: Record<Granularity, (date: Date) => Date> = {
  month: startOfMonth,
  quarter: startOfQuarter,
  year: startOfYear,
}

const addPeriods: Record<Granularity, (date: Date, amount: number) => Date> = {
  month: addMonths,
  quarter: addQuarters,
  year: addYears,
}

export function periodKey(date: Date, granularity: Granularity): string {
  const start = startOfPeriod[granularity](date)
  if (granularity === 'month') return format(start, 'yyyy-MM')
  if (granularity === 'quarter') return `${format(start, 'yyyy')}-Q${getQuarter(start)}`
  return format(start, 'yyyy')
}

export function periodLabel(date: Date, granularity: Granularity): string {
  const start = startOfPeriod[granularity](date)
  if (granularity === 'month') return format(start, 'MMM yyyy')
  if (granularity === 'quarter') return `Q${getQuarter(start)} ${format(start, 'yyyy')}`
  return format(start, 'yyyy')
}

/** The singular noun for prose like "no prior month to compare". */
export const GRANULARITY_NOUN: Record<Granularity, string> = {
  month: 'month',
  quarter: 'quarter',
  year: 'year',
}

function toPeriod(start: Date, granularity: Granularity): Period {
  return {
    key: periodKey(start, granularity),
    label: periodLabel(start, granularity),
    start,
    end: addPeriods[granularity](start, 1),
  }
}

/**
 * `count` periods ending with the one containing `reference`, oldest first.
 *
 * The current period is included even though it is incomplete — leaving it out
 * hides the thing people most want to see, and the charts mark it as in
 * progress instead.
 */
export function buildPeriods(
  granularity: Granularity,
  count: number,
  reference: Date = new Date(),
): Period[] {
  const current = startOfPeriod[granularity](reference)
  const periods: Period[] = []

  for (let offset = count - 1; offset >= 0; offset -= 1) {
    periods.push(toPeriod(addPeriods[granularity](current, -offset), granularity))
  }

  return periods
}

/** The period immediately before `period` — the baseline for a comparison. */
export function priorPeriod(period: Period, granularity: Granularity): Period {
  return toPeriod(addPeriods[granularity](period.start, -1), granularity)
}

/**
 * Tally ISO timestamps into period buckets.
 *
 * Timestamps outside the supplied periods are dropped rather than clamped into
 * the nearest bucket, which would silently inflate the oldest column.
 */
export function bucketByPeriod(
  timestamps: readonly string[],
  periods: readonly Period[],
  granularity: Granularity,
): Map<string, number> {
  const counts = new Map<string, number>(periods.map((period) => [period.key, 0]))

  for (const timestamp of timestamps) {
    const date = new Date(timestamp)
    if (Number.isNaN(date.getTime())) continue

    const key = periodKey(date, granularity)
    const existing = counts.get(key)
    if (existing !== undefined) counts.set(key, existing + 1)
  }

  return counts
}

/**
 * Percentage change, or null when there is no baseline to compare against.
 *
 * Null is the signal the UI uses to render "no prior period" rather than a
 * delta chip. Growth from zero is not a percentage, and showing one would
 * invent a trend out of a portal that simply had not launched yet.
 */
export function percentChange(current: number, prior: number): number | null {
  if (prior <= 0) return null
  return ((current - prior) / prior) * 100
}

/**
 * Tally every timestamp by period key, unrestricted by a window.
 *
 * Used for the comparison baseline: a period just outside the displayed window
 * is still a legitimate thing to compare against, so the prior-period lookup
 * needs counts that reach back further than the chart draws.
 */
export function bucketAll(
  timestamps: readonly string[],
  granularity: Granularity,
): Map<string, number> {
  const counts = new Map<string, number>()

  for (const timestamp of timestamps) {
    const date = new Date(timestamp)
    if (Number.isNaN(date.getTime())) continue

    const key = periodKey(date, granularity)
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }

  return counts
}

export interface PeriodComparison {
  period: Period
  current: number
  /** Null means "we cannot know", never "zero". */
  prior: number | null
  change: number | null
}

/**
 * Pair each period with the one before it.
 *
 * The distinction that matters here is between a period that was genuinely
 * empty and one that predates the portal. Once `earliest` — the first request
 * ever recorded — is known, a prior period ending before it is not a quiet
 * month, it is a month when nothing existed to record. That returns null, so
 * the UI says "no prior month" instead of reporting an infinite rise from zero.
 */
export function comparePeriods(
  counts: Map<string, number>,
  periods: readonly Period[],
  granularity: Granularity,
  earliest: Date | null,
): PeriodComparison[] {
  return periods.map((period) => {
    const current = counts.get(period.key) ?? 0
    const previous = priorPeriod(period, granularity)

    // No data at all, or the baseline period closed before the portal saw its
    // first request: there is nothing to compare against.
    if (!earliest || previous.end <= earliest) {
      return { period, current, prior: null, change: null }
    }

    const prior = counts.get(previous.key) ?? 0
    return { period, current, prior, change: percentChange(current, prior) }
  })
}

/**
 * Whether a chart has enough to say.
 *
 * One populated bucket is a fact, not a trend; drawing a lone bar under a
 * "requests over time" heading reads as either a bug or a collapse. Below this
 * threshold the UI shows an empty state explaining the page fills in over time.
 */
export function hasEnoughHistory(counts: Map<string, number>): boolean {
  let populated = 0
  for (const value of counts.values()) {
    if (value > 0) populated += 1
    if (populated >= 2) return true
  }
  return false
}

/** The full span covered by a window, for labelling exports and headings. */
export function windowRange(periods: readonly Period[]): { start: Date; end: Date } | null {
  if (periods.length === 0) return null
  return { start: periods[0].start, end: periods[periods.length - 1].end }
}
