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

const AUDIO_MIC_FIELDS = ['micType', 'handheldCount', 'headsetCount', 'wiredCount'] as const
const AUDIO_WIRELESS_ONLY = ['handheldCount', 'headsetCount'] as const
const AUDIO_WIRED_ONLY = ['wiredCount'] as const

const PHOTO_FIELDS = [
  'photographerCount',
  'photoPurpose',
  'photoLocation',
  'photoDeliverables',
] as const
const VIDEO_FIELDS = [
  'videographerCount',
  'videoType',
  'videoAudience',
  'videoLocation',
  'videoFormat',
  'videoDeadline',
] as const

const CONTENT_BRANCH_FIELDS = {
  graphics: ['description', 'mobileVersion', 'horizontalVersion'],
  video: ['videoBrief', 'videoDeadline'],
  printing: ['printType', 'printDescription', 'quantity', 'width', 'height'],
} as const satisfies Record<(typeof CONTENT_TYPES)[number], readonly string[]>

function abandonedDetailKeys(team: Team, details: Record<string, unknown>): readonly string[] {
  if (team === 'audio') {
    if (details.requiresMics !== 'yes') return AUDIO_MIC_FIELDS
    if (details.micType === 'wireless') return AUDIO_WIRED_ONLY
    if (details.micType === 'wired') return AUDIO_WIRELESS_ONLY
    return []
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

export const AUDIO_LOCATIONS = ['main-hall', 'gym', 'outdoors', 'bky-rooms'] as const

export const audioDetailsSchema = z
  .object({
    location: z.enum(AUDIO_LOCATIONS, {
      errorMap: () => ({ message: 'Select a location' }),
    }),
    requiresMics: yesNo,
    micType: z.enum(['wireless', 'wired']).optional(),
    handheldCount: count('Enter a number of handheld mics').optional(),
    headsetCount: count('Enter a number of headsets').optional(),
    wiredCount: count('Enter a number of wired mics', 1).optional(),
    requiresSpeakers: yesNo,
    audioDescription: z.string().trim().optional().or(z.literal('')),
  })
  .superRefine((value, ctx) => {
    if (value.requiresMics !== 'yes') return

    if (!value.micType) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['micType'],
        message: 'Select a microphone type',
      })
      return
    }

    if (value.micType === 'wireless') {
      if (value.handheldCount === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['handheldCount'],
          message: 'Enter how many handheld mics are needed',
        })
      }
      if (value.headsetCount === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['headsetCount'],
          message: 'Enter how many headsets are needed',
        })
      }
      if ((value.handheldCount ?? 0) + (value.headsetCount ?? 0) === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['handheldCount'],
          message: 'Request at least one handheld mic or headset',
        })
      }
    }

    if (value.micType === 'wired' && value.wiredCount === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['wiredCount'],
        message: 'Enter how many wired mics are needed',
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
    photographerCount: count('Enter a number of photographers', 1).optional(),
    photoPurpose: z.enum(PHOTO_PURPOSES).optional(),
    photoLocation: z.string().trim().optional().or(z.literal('')),
    photoDeliverables: z.string().trim().optional().or(z.literal('')),

    requiresVideo: yesNo,
    videographerCount: count('Enter a number of videographers', 1).optional(),
    videoType: z.enum(VIDEO_TYPES).optional(),
    videoAudience: z.string().trim().optional().or(z.literal('')),
    videoLocation: z.string().trim().optional().or(z.literal('')),
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

    if (value.requiresPhoto === 'yes') {
      required('photographerCount', value.photographerCount, 'Enter how many photographers are needed')
      required('photoPurpose', value.photoPurpose, 'Select the purpose of the photography')
      required('photoLocation', value.photoLocation, 'Describe the location and setting')
      required('photoDeliverables', value.photoDeliverables, 'Describe the required deliverables')
    }

    if (value.requiresVideo === 'yes') {
      required('videographerCount', value.videographerCount, 'Enter how many videographers are needed')
      required('videoType', value.videoType, 'Select the type of video')
      required('videoAudience', value.videoAudience, 'Describe the intended use and audience')
      required('videoLocation', value.videoLocation, 'Describe where the videography takes place')
      required('videoFormat', value.videoFormat, 'Select live, recorded, or both')
      required('videoDeadline', value.videoDeadline, 'Enter the deadline for the completed video')
    }
  })
  .transform((value) => pruneDetails('photo-video', value))

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

export const requestSchema = z
  .discriminatedUnion('team', [
    audioRequestSchema,
    photoVideoRequestSchema,
    contentCreationRequestSchema,
  ])
  .superRefine((value, ctx) => {
    if (value.team === 'content-creation') requirePrintArtwork(value, ctx)
  })

export type RequestInput = z.infer<typeof requestSchema>
export type RequestDetails = RequestInput['details']

/** The union member for one team — used as the wizard resolver once a team is picked. */
export function schemaForTeam(team: Team) {
  switch (team) {
    case 'audio':
      return audioRequestSchema
    case 'photo-video':
      return photoVideoRequestSchema
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
