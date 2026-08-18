/**
 * Small summary statistics, kept separate so they can be reasoned about — and
 * corrected — without touching a query.
 *
 * Turnaround times are heavily right-skewed: most requests are handled quickly
 * and a few sit over a holiday weekend. A mean reports neither group, drifting
 * upward until it describes no request anyone recognises. So the dashboard
 * reports the median (what a typical request looks like) alongside p90 (what
 * the bad tail looks like), and never a bare average.
 */

export const SECONDS_PER_HOUR = 3600
export const SECONDS_PER_DAY = 86400

/** Nearest-rank percentile. `p` is a fraction: 0.5 for the median, 0.9 for p90. */
export function percentile(values: readonly number[], p: number): number | null {
  if (values.length === 0) return null

  const sorted = [...values].sort((a, b) => a - b)
  const rank = Math.ceil(p * sorted.length)
  const index = Math.min(Math.max(rank, 1), sorted.length) - 1

  return sorted[index]
}

export function median(values: readonly number[]): number | null {
  return percentile(values, 0.5)
}

export function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0)
}

export function toHours(seconds: number): number {
  return seconds / SECONDS_PER_HOUR
}

export function toDays(seconds: number): number {
  return seconds / SECONDS_PER_DAY
}

/** One decimal place, which is as much precision as any of these figures earn. */
export function round1(value: number): number {
  return Math.round(value * 10) / 10
}

export function roundedHours(seconds: number | null): number | null {
  return seconds === null ? null : round1(toHours(seconds))
}

/**
 * A duration in the largest unit that still reads naturally.
 *
 * Turnaround spans minutes to weeks depending on the request, and "0.04 days"
 * or "312 hours" both make a reader do arithmetic to understand a number that
 * should be obvious at a glance.
 */
export function formatDuration(seconds: number | null): string {
  if (seconds === null) return '—'
  if (seconds < 60) return '< 1 min'

  const minutes = seconds / 60
  if (minutes < 60) return `${Math.round(minutes)} min`

  const hours = seconds / SECONDS_PER_HOUR
  if (hours < 48) return `${round1(hours)} h`

  const days = seconds / SECONDS_PER_DAY
  return `${round1(days)} d`
}

/**
 * A count and its share of a total, guarding the empty case.
 *
 * Zero out of zero is 0%, not NaN — but it is also not a meaningful
 * proportion, so callers showing a rate should check the total themselves.
 */
export function share(count: number, total: number): number {
  if (total <= 0) return 0
  return (count / total) * 100
}
