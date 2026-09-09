import {
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
  eventName: string
  eventDate: string
  eventTime: string
  team: Team | ''
  details: Record<string, string>
  files: UploadedFile[]
}

export const emptyFormValues: RequestFormValues = {
  fullName: '',
  email: '',
  phone: '',
  department: '',
  eventName: '',
  eventDate: '',
  eventTime: '',
  team: '',
  details: {},
  files: [],
}

/**
 * Drop blank answers so optional fields read as absent rather than as an empty
 * string, and fold the split date and time back into a single instant.
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
    department: values.department,
    eventName: values.eventName,
    eventDateTime: combineDateTime(values.eventDate, values.eventTime),
    team: values.team || undefined,
    details,
    files: values.files ?? [],
  }
}

/**
 * The one instant the API takes, from the two boxes the form asks for.
 *
 * The date and the time are separate inputs because a single `datetime-local`
 * is fiddly to type into and renders differently in every browser. Nothing
 * downstream knows about the split -- it is joined here, and `event_datetime`
 * stays one column.
 *
 * Both halves are needed: a date without a time is not an instant, and the empty
 * string lets the schema report it as missing rather than inventing midnight.
 */
export function combineDateTime(date: string, time: string): string {
  if (!date || !time) return ''

  // The joined value is naive local time, which is what the requestor meant;
  // storing the true instant is what makes it comparable across time zones.
  const parsed = new Date(`${date}T${time}`)

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

  // `eventDateTime` is not a field on this form, so an issue against it has no
  // input to attach to and would be silently dropped by setError. Point at
  // whichever half is actually missing instead -- and collapse them, since an
  // empty value trips both the required check and the parse check.
  const others = raw.filter((issue) => issue.path !== 'eventDateTime')

  return {
    ok: false,
    issues: others.length === raw.length ? others : [...others, ...dateTimeIssues(values)],
  }
}

/**
 * Which half of the event instant to complain about.
 *
 * With both halves filled the combined value parsed badly rather than being
 * absent, which is not something either input can be blamed for on its own; the
 * date is where the message reads most naturally.
 */
function dateTimeIssues(values: RequestFormValues): ValidationIssue[] {
  const issues: ValidationIssue[] = []

  if (!values.eventDate) issues.push({ path: 'eventDate', message: 'Event date is required' })
  if (!values.eventTime) issues.push({ path: 'eventTime', message: 'Event time is required' })

  return issues.length > 0
    ? issues
    : [{ path: 'eventDate', message: 'Enter a valid date and time' }]
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
    owns: (path) => ['fullName', 'email', 'phone', 'department'].includes(path),
  },
  {
    id: 'event',
    title: 'Event details',
    shortTitle: 'Event',
    description: 'What the request is for, and when it happens.',
    owns: (path) => ['eventName', 'eventDate', 'eventTime'].includes(path),
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
