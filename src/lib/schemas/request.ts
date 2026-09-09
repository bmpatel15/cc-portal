import { z } from 'zod'

/**
 * The single source of truth for a content request.
 *
 * The same schemas validate the wizard on the client and the payload on the server,
 * and produce the TypeScript types used everywhere else. A question that exists in
 * the form therefore cannot be silently dropped on the way to the database.
 */

export const TEAMS = ['audio', 'photo-video', 'content-creation'] as const
export const teamSchema = z.enum(TEAMS)
export type Team = z.infer<typeof teamSchema>

export const REQUEST_STATUSES = [
  'pending',
  'in_progress',
  'review',
  'complete',
  'cancelled',
] as const
export const requestStatusSchema = z.enum(REQUEST_STATUSES)
export type RequestStatus = z.infer<typeof requestStatusSchema>

/**
 * The happy path a request walks. `cancelled` sits outside it — it is reachable
 * from anywhere but is not a stage.
 *
 * Both the tracking timeline and the permission rules read this, so "forward"
 * means the same thing to the UI and to the server.
 */
export const STATUS_PIPELINE = [
  'pending',
  'in_progress',
  'review',
  'complete',
] as const satisfies readonly RequestStatus[]

/**
 * Statuses that take a request off the board.
 *
 * Neither is a dead end — an admin can reopen either — but a request in one of
 * these needs nothing from the team, so the dashboard leaves it out until it is
 * asked for by name.
 */
export const CLOSED_STATUSES = ['complete', 'cancelled'] as const satisfies readonly RequestStatus[]

export function isClosed(status: RequestStatus): boolean {
  return (CLOSED_STATUSES as readonly RequestStatus[]).includes(status)
}

const yesNo = z.enum(['yes', 'no'])
export type YesNo = z.infer<typeof yesNo>

const requiredText = (message: string) => z.string().trim().min(1, message)
const count = (message: string, min = 0) =>
  z.coerce.number({ invalid_type_error: message }).int(message).min(min, message)

/* -------------------------------------------------------------------------- */
/* Uploaded files                                                             */
/* -------------------------------------------------------------------------- */

export const MAX_FILE_BYTES = 100 * 1024 * 1024 // 100MB

/**
 * How many attachments one request may carry.
 *
 * The wizard enforces this before uploading rather than after, so an eleventh
 * file is never pushed to storage and then quietly dropped from the form.
 */
export const MAX_FILES = 10

/**
 * The crew the team can actually staff.
 *
 * The form offers these as the only choices, so an unrealistic ask cannot be
 * typed; the schema enforces them again because /api/requests takes a JSON body
 * from anyone. One number, so the dropdown and the message cannot drift apart.
 */
export const MAX_PHOTOGRAPHERS = 5
export const MAX_VIDEOGRAPHERS = 3

/** Keep in sync with the bucket's allowed_mime_types in supabase/migrations. */
export const ALLOWED_FILE_TYPES = [
  'image/jpeg',
  'image/png',
  'application/pdf',
  'application/msword', // .doc
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
] as const
export type AllowedFileType = (typeof ALLOWED_FILE_TYPES)[number]

export const ALLOWED_FILE_EXTENSIONS = '.jpg,.jpeg,.png,.pdf,.doc,.docx'

/** One phrasing for the accept list, so UI copy and zod messages cannot drift. */
export const ALLOWED_FILE_LABEL = 'JPG, PNG, PDF, or Word'

export const uploadedFileSchema = z.object({
  name: requiredText('File name is required'),
  path: requiredText('File path is required'),

  /** Issued by /api/uploads/sign and checked on submit; see lib/uploads. */
  signature: requiredText('File signature is required'),
  size: z.number().int().min(0).max(MAX_FILE_BYTES, 'File exceeds the 100MB limit'),
  contentType: z.enum(ALLOWED_FILE_TYPES, {
    errorMap: () => ({ message: `Upload a ${ALLOWED_FILE_LABEL} file` }),
  }),
})
export type UploadedFile = z.infer<typeof uploadedFileSchema>

/* -------------------------------------------------------------------------- */
/* Shared fields                                                              */
/* -------------------------------------------------------------------------- */

/**
 * The departments a requestor can pick from.
 *
 * The values are the labels rather than slugs, because `department` is shown
 * verbatim in the staff email, the admin drawer, the tracking page and the CSV
 * export -- and because rows submitted before this was a dropdown hold free
 * text. Keeping them human-readable means nothing downstream needs a lookup and
 * old rows stay consistent with new ones.
 */
export const DEPARTMENTS = [
  'Satsang Pravrutti',
  'Services',
  'CA/PA',
  'Facilities',
  'Network',
  'IT',
  'Other',
] as const

/** Picking this reveals a free-text box, and that answer is what gets stored. */
export const DEPARTMENT_OTHER = 'Other'

/**
 * The places an event happens, shared by every team that asks where.
 *
 * Audio has always picked from this list; photo and video used to take free
 * text, which spelled the same room four ways and could not be compared across
 * requests. `OTHER_OPTION` is the escape hatch for anywhere not listed -- the
 * typed answer is folded into the location itself before it is stored.
 */
export const LOCATIONS = ['main-hall', 'gym', 'outdoors', 'bky-rooms'] as const

/** The dropdown member that reveals a box to type in. Shared with purposes and video types. */
export const OTHER_OPTION = 'other'
export const LOCATIONS_WITH_OTHER = [...LOCATIONS, OTHER_OPTION] as const

export const contactFields = {
  fullName: requiredText('Full name is required'),
  email: z.string().trim().email('Enter a valid email address'),
  phone: z.string().trim().max(40, 'Phone number is too long').optional().or(z.literal('')),
  department: requiredText('Department is required'),
}

export const eventFields = {
  eventName: requiredText('Event name is required'),
  eventDate: requiredText('Event date is required').refine(
    (value) => !Number.isNaN(Date.parse(value)),
    'Enter a valid date',
  ),
}

const baseSchema = z.object({ ...contactFields, ...eventFields })

/* -------------------------------------------------------------------------- */
/* Abandoned branches                                                         */
/* -------------------------------------------------------------------------- */

/**
 * Answers belonging to a branch the requestor did not choose.
 *
 * The wizard hides a question when its branch closes, but the answer stays in
 * the form state, and `superRefine` only ever *requires* fields -- it never
 * removes one. So someone who said photography was needed, entered three
 * photographers, then switched to "no" still submitted `photographerCount: 3`.
 * It was rendered in the staff email and on the tracking page under
 * "Photographers required", and `summariseEffort` added it to the team's
 * photographer total, inflating the effort chart with crew for a request that
 * explicitly asked for no photography.
 *
 * Pruning happens in the schema rather than in the wizard so the API is covered
 * too: these routes accept a JSON body from anyone, and a hand-rolled POST is
 * exactly as able to carry a contradictory field as the form was.
 */

const AUDIO_MIC_FIELDS = ['handheldCount', 'headsetCount', 'wiredCount'] as const

const PHOTO_FIELDS = [
  'photographerCount',
  'photoPurpose',
  'photoPurposeOther',
  'photoLocation',
  'photoLocationOther',
  'photoLocationNotes',
  'photoDeliverables',
] as const
const VIDEO_FIELDS = [
  'videographerCount',
  'videoType',
  'videoTypeOther',
  'videoAudience',
  'videoLocation',
  'videoLocationOther',
  'videoLocationNotes',
  'videoFormat',
  'videoDeadline',
] as const

const CONTENT_BRANCH_FIELDS = {
  graphics: ['description', 'mobileVersion', 'horizontalVersion'],
  video: ['videoBrief', 'videoDeadline'],
  printing: ['printType', 'printDescription', 'quantity', 'width', 'height'],
} as const satisfies Record<(typeof CONTENT_TYPES)[number], readonly string[]>

/** Blank, or a count of zero -- either way, none of that kind were requested. */
function isNone(value: unknown): boolean {
  if (value === undefined || value === null || value === '') return true

  return Number(value) === 0
}

function abandonedDetailKeys(team: Team, details: Record<string, unknown>): readonly string[] {
  if (team === 'audio') {
    if (details.requiresMics !== 'yes') return AUDIO_MIC_FIELDS

    // A mic type left blank, or set to none, was not asked for -- the request
    // reads as "two handhelds", not "two handhelds, no headsets, no wired".
    return AUDIO_MIC_FIELDS.filter((field) => isNone(details[field]))
  }

  if (team === 'photo-video') {
    return [
      ...(details.requiresPhoto === 'yes' ? [] : PHOTO_FIELDS),
      ...(details.requiresVideo === 'yes' ? [] : VIDEO_FIELDS),
    ]
  }

  return Object.entries(CONTENT_BRANCH_FIELDS)
    .filter(([type]) => type !== details.contentType)
    .flatMap(([, fields]) => fields)
}

/**
 * The answers as they should be stored: "Other" folded into the answer it
 * qualifies.
 *
 * A location and the box that appears when "Other" is picked are one answer by
 * the time anyone reads the record, exactly as a department and its "Other" box
 * are (`resolveDepartment` in the wizard). Folding them here rather than in the
 * form means the API is covered too, and the staff email shows one
 * "Photography location: Backyard" line instead of "Other" and a second row.
 *
 * Exported for the review step, which previews the record before it exists.
 */
const OTHER_PAIRS = [
  ['photoPurpose', 'photoPurposeOther'],
  ['photoLocation', 'photoLocationOther'],
  ['videoType', 'videoTypeOther'],
  ['videoLocation', 'videoLocationOther'],
] as const

export function resolveDetails<T extends Record<string, unknown>>(team: Team, details: T): T {
  if (team !== 'photo-video') return details

  const resolved: Record<string, unknown> = { ...details }

  for (const [answer, other] of OTHER_PAIRS) {
    const typed = String(resolved[other] ?? '').trim()

    // Only a typed answer replaces "Other". The purpose boxes are optional, and
    // an empty one has to leave the dropdown's own answer standing rather than
    // blanking a question the requestor did answer.
    if (resolved[answer] === OTHER_OPTION && typed !== '') resolved[answer] = typed
    delete resolved[other]
  }

  return resolved as T
}

/**
 * The answers as they should be stored: the chosen branch only.
 *
 * Exported so the review step can show exactly what will be submitted rather
 * than everything the form happens to be holding.
 */
export function pruneDetails<T extends Record<string, unknown>>(team: Team, details: T): T {
  const abandoned = abandonedDetailKeys(team, details)

  if (abandoned.length === 0) return details

  const pruned: Record<string, unknown> = { ...details }
  for (const key of abandoned) delete pruned[key]

  return pruned as T
}

/* -------------------------------------------------------------------------- */
/* Audio                                                                      */
/* -------------------------------------------------------------------------- */

export const audioDetailsSchema = z
  .object({
    location: z.enum(LOCATIONS, {
      errorMap: () => ({ message: 'Select a location' }),
    }),
    requiresMics: yesNo,
    handheldCount: count('Enter a number of wireless handheld mics').optional(),
    headsetCount: count('Enter a number of wireless headsets').optional(),
    wiredCount: count('Enter a number of wired mics').optional(),
    requiresSpeakers: yesNo,
    audioDescription: z.string().trim().optional().or(z.literal('')),
  })
  .superRefine((value, ctx) => {
    if (value.requiresMics !== 'yes') return

    // The three kinds are independent: an event can need two handhelds and a
    // wired mic at the podium. Each box may be left blank, so the only rule is
    // that saying "yes" to microphones has to add up to at least one of them.
    const total =
      (value.handheldCount ?? 0) + (value.headsetCount ?? 0) + (value.wiredCount ?? 0)

    if (total === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['handheldCount'],
        message: 'Enter how many of at least one kind of microphone are needed',
      })
    }
  })
  .transform((value) => pruneDetails('audio', value))

export type AudioDetails = z.infer<typeof audioDetailsSchema>

/* -------------------------------------------------------------------------- */
/* Photo / Video                                                              */
/* -------------------------------------------------------------------------- */

export const PHOTO_PURPOSES = ['event-coverage', 'invited-guests', 'other'] as const
export const VIDEO_TYPES = ['interviews', 'program-recording', 'other'] as const
export const VIDEO_FORMATS = ['live', 'recorded', 'both'] as const

export const photoVideoDetailsSchema = z
  .object({
    requiresPhoto: yesNo,
    photographerCount: count('Enter a number of photographers', 1)
      .max(MAX_PHOTOGRAPHERS, `At most ${MAX_PHOTOGRAPHERS} photographers can be requested`)
      .optional(),
    photoPurpose: z.enum(PHOTO_PURPOSES).optional(),
    photoPurposeOther: z.string().trim().optional().or(z.literal('')),
    photoLocation: z.enum(LOCATIONS_WITH_OTHER).optional(),
    photoLocationOther: z.string().trim().optional().or(z.literal('')),
    photoLocationNotes: z.string().trim().optional().or(z.literal('')),
    photoDeliverables: z.string().trim().optional().or(z.literal('')),

    requiresVideo: yesNo,
    videographerCount: count('Enter a number of videographers', 1)
      .max(MAX_VIDEOGRAPHERS, `At most ${MAX_VIDEOGRAPHERS} videographers can be requested`)
      .optional(),
    videoType: z.enum(VIDEO_TYPES).optional(),
    videoTypeOther: z.string().trim().optional().or(z.literal('')),
    videoAudience: z.string().trim().optional().or(z.literal('')),
    videoLocation: z.enum(LOCATIONS_WITH_OTHER).optional(),
    videoLocationOther: z.string().trim().optional().or(z.literal('')),
    videoLocationNotes: z.string().trim().optional().or(z.literal('')),
    videoFormat: z.enum(VIDEO_FORMATS).optional(),
    videoDeadline: z.string().trim().optional().or(z.literal('')),
  })
  .superRefine((value, ctx) => {
    const required = (path: string, present: unknown, message: string) => {
      if (present === undefined || present === '') {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: [path], message })
      }
    }

    if (value.requiresPhoto === 'no' && value.requiresVideo === 'no') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['requiresPhoto'],
        message: 'Request photography, videography, or both',
      })
    }

    // "Other" is only half an answer: the box that appears beside it has to say
    // where, or the record reads "Other" and nobody knows the room.
    const requireLocation = (path: string, location: unknown, other: unknown) => {
      required(path, location, 'Select a location')
      if (location === OTHER_OPTION) {
        required(`${path}Other`, other, 'Enter the location')
      }
    }

    if (value.requiresPhoto === 'yes') {
      required('photographerCount', value.photographerCount, 'Enter how many photographers are needed')
      required('photoPurpose', value.photoPurpose, 'Select the purpose of the photography')
      requireLocation('photoLocation', value.photoLocation, value.photoLocationOther)
    }

    if (value.requiresVideo === 'yes') {
      required('videographerCount', value.videographerCount, 'Enter how many videographers are needed')
      required('videoType', value.videoType, 'Select the type of video')
      requireLocation('videoLocation', value.videoLocation, value.videoLocationOther)
      required('videoFormat', value.videoFormat, 'Select live, recorded, or both')
      required('videoDeadline', value.videoDeadline, 'Enter the deadline for the completed video')
    }
  })
  .transform((value) => pruneDetails('photo-video', resolveDetails('photo-video', value)))

export type PhotoVideoDetails = z.infer<typeof photoVideoDetailsSchema>

/* -------------------------------------------------------------------------- */
/* Content creation                                                           */
/* -------------------------------------------------------------------------- */

export const CONTENT_TYPES = ['graphics', 'video', 'printing'] as const
export const PRINT_TYPES = ['podium-banner', 'vinyl-banner', 'indoor-poster', 'other'] as const

const dimension = (message: string) =>
  z.coerce.number({ invalid_type_error: message }).positive(message)

export const contentCreationDetailsSchema = z
  .object({
    contentType: z.enum(CONTENT_TYPES, {
      errorMap: () => ({ message: 'Select a content type' }),
    }),

    // graphics
    description: z.string().trim().optional().or(z.literal('')),
    mobileVersion: yesNo.optional(),
    horizontalVersion: yesNo.optional(),

    // video creation
    videoBrief: z.string().trim().optional().or(z.literal('')),
    videoDeadline: z.string().trim().optional().or(z.literal('')),

    // printing
    printType: z.enum(PRINT_TYPES).optional(),
    printDescription: z.string().trim().optional().or(z.literal('')),
    quantity: z.coerce.number({ invalid_type_error: 'Enter a quantity' }).int().min(1, 'Enter a quantity').optional(),
    width: dimension('Enter a width in inches').optional(),
    height: dimension('Enter a height in inches').optional(),
  })
  .superRefine((value, ctx) => {
    const required = (path: string, present: unknown, message: string) => {
      if (present === undefined || present === '') {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: [path], message })
      }
    }

    if (value.contentType === 'graphics') {
      required('description', value.description, 'Describe what is needed')
      required('mobileVersion', value.mobileVersion, 'Select whether a mobile version is needed')
      required('horizontalVersion', value.horizontalVersion, 'Select whether a horizontal version is needed')
    }

    if (value.contentType === 'video') {
      required('videoBrief', value.videoBrief, 'Describe the video that is needed')
      required('videoDeadline', value.videoDeadline, 'Enter the deadline for the completed video')
    }

    if (value.contentType === 'printing') {
      required('printType', value.printType, 'Select a print type')
      required('quantity', value.quantity, 'Enter a quantity')
      required('width', value.width, 'Enter a width in inches')
      required('height', value.height, 'Enter a height in inches')

      if (value.printType === 'other') {
        required('printDescription', value.printDescription, 'Describe the print that is needed')
      }
    }
  })
  .transform((value) => pruneDetails('content-creation', value))

export type ContentCreationDetails = z.infer<typeof contentCreationDetailsSchema>

/* -------------------------------------------------------------------------- */
/* Full request                                                               */
/* -------------------------------------------------------------------------- */

const audioRequestSchema = baseSchema.extend({
  team: z.literal('audio'),
  details: audioDetailsSchema,
  files: z.array(uploadedFileSchema)
    .max(MAX_FILES, `Attach at most ${MAX_FILES} files`)
    .default([]),
})

const photoVideoRequestSchema = baseSchema.extend({
  team: z.literal('photo-video'),
  details: photoVideoDetailsSchema,
  files: z.array(uploadedFileSchema)
    .max(MAX_FILES, `Attach at most ${MAX_FILES} files`)
    .default([]),
})

const contentCreationRequestSchema = baseSchema.extend({
  team: z.literal('content-creation'),
  details: contentCreationDetailsSchema,
  files: z.array(uploadedFileSchema)
    .max(MAX_FILES, `Attach at most ${MAX_FILES} files`)
    .default([]),
})

/**
 * Printing needs artwork. Lives outside the object schemas because
 * `z.discriminatedUnion` only accepts plain objects as members — applying a
 * refinement to a member would turn it into a `ZodEffects` and break the union.
 */
function requirePrintArtwork(
  value: { details: { contentType: string }; files: unknown[] },
  ctx: z.RefinementCtx,
) {
  if (value.details.contentType === 'printing' && value.files.length === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['files'],
      message: 'Upload the artwork for the print request',
    })
  }
}

/**
 * A video cannot be due before the event it films. Lives outside the details
 * schema, which cannot see the event date, and outside the union members for the
 * same reason `requirePrintArtwork` does.
 */
function requireDeadlineAfterEvent(
  value: { eventDate: string; details: { videoDeadline?: string } },
  ctx: z.RefinementCtx,
) {
  const deadline = value.details.videoDeadline
  if (!deadline) return

  // The event date is stored as midnight UTC, so the deadline is read the same
  // way -- otherwise a day either side of it would compare by the hour.
  const due = Date.parse(`${deadline}T00:00:00Z`)
  const event = Date.parse(value.eventDate)

  if (!Number.isNaN(due) && !Number.isNaN(event) && due < event) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['details', 'videoDeadline'],
      message: 'The deadline cannot be before the event date',
    })
  }
}

export const requestSchema = z
  .discriminatedUnion('team', [
    audioRequestSchema,
    photoVideoRequestSchema,
    contentCreationRequestSchema,
  ])
  .superRefine((value, ctx) => {
    if (value.team === 'content-creation') requirePrintArtwork(value, ctx)
    if (value.team === 'photo-video') requireDeadlineAfterEvent(value, ctx)
  })

export type RequestInput = z.infer<typeof requestSchema>
export type RequestDetails = RequestInput['details']

/** The union member for one team — used as the wizard resolver once a team is picked. */
export function schemaForTeam(team: Team) {
  switch (team) {
    case 'audio':
      return audioRequestSchema
    case 'photo-video':
      return photoVideoRequestSchema.superRefine(requireDeadlineAfterEvent)
    case 'content-creation':
      return contentCreationRequestSchema.superRefine(requirePrintArtwork)
  }
}

/** Loose shape used before a team has been chosen, so early steps can still validate. */
export const partialRequestSchema = baseSchema.extend({
  team: teamSchema.optional(),
})

/* -------------------------------------------------------------------------- */
/* Status changes and assignment                                              */
/* -------------------------------------------------------------------------- */

export const statusUpdateSchema = z.object({
  requestId: z.string().uuid(),
  status: requestStatusSchema,
  note: z.string().trim().max(2000).optional().or(z.literal('')),
})
export type StatusUpdate = z.infer<typeof statusUpdateSchema>

/** `assigneeId: null` unassigns. Who may do that is decided in permissions.ts. */
export const assignmentSchema = z.object({
  requestId: z.string().uuid(),
  assigneeId: z.string().uuid().nullable(),
})
export type Assignment = z.infer<typeof assignmentSchema>

export const signUploadSchema = z.object({
  fileName: requiredText('File name is required'),
  /** Advisory only — the route derives the real type from `fileName`. */
  contentType: z.string().trim().optional(),
  size: z.number().int().min(1).max(MAX_FILE_BYTES, 'File exceeds the 100MB limit'),
})
export type SignUploadInput = z.infer<typeof signUploadSchema>
