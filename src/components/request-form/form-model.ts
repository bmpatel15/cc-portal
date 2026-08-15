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
  eventDateTime: string
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
  eventDateTime: '',
  team: '',
  details: {},
  files: [],
}

/**
 * Drop blank answers so optional fields read as absent rather than as an empty
 * string, and normalise the naive datetime-local value to a real instant.
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
    eventDateTime: values.eventDateTime ? toIsoInstant(values.eventDateTime) : '',
    team: values.team || undefined,
    details,
    files: values.files ?? [],
  }
}

/** `datetime-local` yields a naive local string; store the true instant. */
function toIsoInstant(value: string): string {
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? value : parsed.toISOString()
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

  return {
    ok: false,
    issues: result.error.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
    })),
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
    owns: (path) => ['fullName', 'email', 'phone', 'department'].includes(path),
  },
  {
    id: 'event',
    title: 'Event details',
    shortTitle: 'Event',
    description: 'What the request is for, and when it happens.',
    owns: (path) => ['eventName', 'eventDateTime'].includes(path),
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
