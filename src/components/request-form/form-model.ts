import {
  DEPARTMENT_OTHER,
  partialRequestSchema,
  schemaForTeam,
  type RequestInput,
  type Team,
  type UploadedFile,
} from '@/lib/schemas/request'

/**
 * The wizard keeps every answer as a string (that is what inputs produce) in a
 * single `details` bag, then hands it to the Zod schemas for coercion and
 * validation. One schema therefore governs both the wizard and the API — the
 * form cannot drift out of sync with what the server accepts.
 */

export interface RequestFormValues {
  fullName: string
  email: string
  phone: string
  department: string
  departmentOther: string
  eventName: string
  eventDate: string
  team: Team | ''
  details: Record<string, string>
  files: UploadedFile[]
}

export const emptyFormValues: RequestFormValues = {
  fullName: '',
  email: '',
  phone: '',
  department: '',
  departmentOther: '',
  eventName: '',
  eventDate: '',
  team: '',
  details: {},
  files: [],
}

/**
 * Drop blank answers so optional fields read as absent rather than as an empty
 * string, and turn the picked day into the instant the API stores.
 */
export function cleanValues(values: RequestFormValues) {
  const details: Record<string, string> = {}

  for (const [key, value] of Object.entries(values.details ?? {})) {
    if (typeof value === 'string' && value.trim() === '') continue
    if (value === undefined || value === null) continue
    details[key] = value
  }

  return {
    fullName: values.fullName,
    email: values.email,
    phone: values.phone,
    department: resolveDepartment(values.department, values.departmentOther),
    eventName: values.eventName,
    eventDate: eventDateInstant(values.eventDate),
    team: values.team || undefined,
    details,
    files: values.files ?? [],
  }
}

/**
 * The department as the API stores it: the picked option, or whatever was typed
 * when the requestor picked "Other".
 *
 * Only the resolved value travels, so a stale "Other" answer left behind by
 * someone who changed their mind cannot reach the record.
 */
export function resolveDepartment(department: string, other: string): string {
  return department === DEPARTMENT_OTHER ? other.trim() : department
}

/**
 * The instant the API takes, from the day the requestor picked.
 *
 * The form asks for a date and nothing more: a requestor booking weeks ahead
 * usually does not know when the event starts yet, and a required time box made
 * them invent one. The column downstream is still a timestamp, so the day is
 * anchored at midnight UTC -- a fixed point that renders as the day that was
 * picked in every time zone, which local midnight would not.
 */
export function eventDateInstant(date: string): string {
  if (!date) return ''

  const parsed = new Date(`${date}T00:00:00Z`)

  return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString()
}

export interface ValidationIssue {
  path: string
  message: string
}

/**
 * Validate the whole request against the schema for the selected team, falling
 * back to the shared fields before a team is chosen.
 */
export function validateValues(values: RequestFormValues): {
  ok: boolean
  data?: RequestInput
  issues: ValidationIssue[]
} {
  const cleaned = cleanValues(values)
  const schema = values.team ? schemaForTeam(values.team) : partialRequestSchema
  const result = schema.safeParse(cleaned)

  if (result.success) {
    return { ok: true, data: values.team ? (result.data as RequestInput) : undefined, issues: [] }
  }

  const raw = result.error.issues.map((issue) => ({
    path: issue.path.join('.'),
    message: issue.message,
  }))

  // `department` is the one schema field assembled from more than one input, so
  // an issue against it has no field to attach to when "Other" is picked and
  // setError would drop it silently -- the wizard would refuse to advance while
  // highlighting nothing. It is pointed at the box the requestor can act on.
  const issues: ValidationIssue[] = []

  for (const issue of raw) {
    if (issue.path === 'department' && values.department === DEPARTMENT_OTHER) {
      issues.push({ path: 'departmentOther', message: 'Enter your department' })
      continue
    }

    issues.push(issue)
  }

  // One message per input. An empty value can trip more than one check, and two
  // errors stacked under one box reads as two separate problems.
  const seen = new Set<string>()

  return {
    ok: false,
    issues: issues.filter((issue) => !seen.has(issue.path) && seen.add(issue.path)),
  }
}

/* -------------------------------------------------------------------------- */
/* Steps                                                                      */
/* -------------------------------------------------------------------------- */

export type StepId = 'contact' | 'event' | 'team' | 'details' | 'review'

export interface StepDefinition {
  id: StepId
  title: string
  shortTitle: string
  description: string
  /** Issue paths this step is responsible for. */
  owns: (path: string) => boolean
}

export const STEPS: StepDefinition[] = [
  {
    id: 'contact',
    title: 'Your information',
    shortTitle: 'Info',
    description: 'So the team knows who to follow up with.',
    owns: (path) =>
      ['fullName', 'email', 'phone', 'department', 'departmentOther'].includes(path),
  },
  {
    id: 'event',
    title: 'Event details',
    shortTitle: 'Event',
    description: 'What the request is for, and when it happens.',
    owns: (path) => ['eventName', 'eventDate'].includes(path),
  },
  {
    id: 'team',
    title: 'Which team do you need?',
    shortTitle: 'Team',
    description: 'Pick the team that can help with this request.',
    owns: (path) => path === 'team',
  },
  {
    id: 'details',
    title: 'Request details',
    shortTitle: 'Details',
    description: 'A few specifics so the team can prepare.',
    owns: (path) => path.startsWith('details') || path.startsWith('files'),
  },
  {
    id: 'review',
    title: 'Review and submit',
    shortTitle: 'Review',
    description: 'Check everything over before sending it in.',
    owns: () => true,
  },
]

export function stepIndex(id: StepId): number {
  return STEPS.findIndex((step) => step.id === id)
}
