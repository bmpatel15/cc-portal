import { z } from 'zod'

import { teamSchema } from './request'

/**
 * Validation for the analytics surface: what the dashboard may ask for, and
 * what staff may log against a request.
 *
 * The filter schema is shared by the page, the CSV route, and the PDF export so
 * a download always describes the same slice the charts were drawn from — the
 * filters travel as query params, and this is the one place they are parsed.
 */

export const GRANULARITIES = ['month', 'quarter', 'year'] as const
export const granularitySchema = z.enum(GRANULARITIES)
export type Granularity = z.infer<typeof granularitySchema>

/**
 * How many periods to draw, per granularity.
 *
 * Defaults are chosen to show a full seasonal cycle without crowding the axis:
 * a year of months, three years of quarters, five years of years.
 */
export const DEFAULT_WINDOW: Record<Granularity, number> = {
  month: 12,
  quarter: 12,
  year: 5,
}

export const MAX_WINDOW = 60

export const analyticsFiltersSchema = z.object({
  granularity: granularitySchema.default('month'),

  /** Number of periods to include, ending with the one in progress. */
  window: z.coerce.number().int().min(1).max(MAX_WINDOW).optional(),

  team: teamSchema.optional(),

  /**
   * Free text, because `requests.department` is free text — matched
   * case-insensitively after trimming rather than against a fixed list.
   */
  department: z.string().trim().min(1).max(120).optional(),
})

export type AnalyticsFilters = z.infer<typeof analyticsFiltersSchema>

export const DATASETS = ['requests', 'summary'] as const
export const datasetSchema = z.enum(DATASETS)
export type Dataset = z.infer<typeof datasetSchema>

export const exportQuerySchema = analyticsFiltersSchema.extend({
  dataset: datasetSchema.default('requests'),
})

/* -------------------------------------------------------------------------- */
/* Logged time                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Hours are capped at 24 per entry: anything larger is a typo or a week's work
 * entered as one row, and both are better caught here than averaged into a
 * chart. Someone who genuinely worked longer can add a second entry.
 */
export const MAX_HOURS_PER_ENTRY = 24

export const timeEntrySchema = z.object({
  requestId: z.string().uuid(),
  hours: z.coerce
    .number({ invalid_type_error: 'Enter the hours worked' })
    .positive('Hours must be greater than zero')
    .max(MAX_HOURS_PER_ENTRY, `Log at most ${MAX_HOURS_PER_ENTRY} hours per entry`),
  note: z.string().trim().max(500).optional(),
  workedOn: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Pick the day the work happened')
    .refine((value) => !Number.isNaN(Date.parse(value)), 'Pick the day the work happened')
    .optional(),
})

export type TimeEntryInput = z.infer<typeof timeEntrySchema>

export const deleteTimeEntrySchema = z.object({
  entryId: z.string().uuid(),
})
