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

const yesNo = z.enum(['yes', 'no'])
export type YesNo = z.infer<typeof yesNo>

const requiredText = (message: string) => z.string().trim().min(1, message)
const count = (message: string, min = 0) =>
  z.coerce.number({ invalid_type_error: message }).int(message).min(min, message)

/* -------------------------------------------------------------------------- */
/* Uploaded files                                                             */
/* -------------------------------------------------------------------------- */

export const MAX_FILE_BYTES = 100 * 1024 * 1024 // 100MB
export const ALLOWED_FILE_TYPES = ['image/jpeg', 'image/png', 'application/pdf'] as const
export const ALLOWED_FILE_EXTENSIONS = '.jpg,.jpeg,.png,.pdf'

export const uploadedFileSchema = z.object({
  name: requiredText('File name is required'),
  path: requiredText('File path is required'),
  size: z.number().int().min(0).max(MAX_FILE_BYTES, 'File exceeds the 100MB limit'),
  contentType: z.enum(ALLOWED_FILE_TYPES, {
    errorMap: () => ({ message: 'Only JPG, PNG, and PDF files are supported' }),
  }),
})
export type UploadedFile = z.infer<typeof uploadedFileSchema>

/* -------------------------------------------------------------------------- */
/* Shared fields                                                              */
/* -------------------------------------------------------------------------- */

export const contactFields = {
  fullName: requiredText('Full name is required'),
  email: z.string().trim().email('Enter a valid email address'),
  phone: z.string().trim().max(40, 'Phone number is too long').optional().or(z.literal('')),
  department: requiredText('Department is required'),
}

export const eventFields = {
  eventName: requiredText('Event name is required'),
  eventDateTime: requiredText('Event date and time are required').refine(
    (value) => !Number.isNaN(Date.parse(value)),
    'Enter a valid date and time',
  ),
}

const baseSchema = z.object({ ...contactFields, ...eventFields })

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

export type ContentCreationDetails = z.infer<typeof contentCreationDetailsSchema>

/* -------------------------------------------------------------------------- */
/* Full request                                                               */
/* -------------------------------------------------------------------------- */

const audioRequestSchema = baseSchema.extend({
  team: z.literal('audio'),
  details: audioDetailsSchema,
  files: z.array(uploadedFileSchema).max(10).default([]),
})

const photoVideoRequestSchema = baseSchema.extend({
  team: z.literal('photo-video'),
  details: photoVideoDetailsSchema,
  files: z.array(uploadedFileSchema).max(10).default([]),
})

const contentCreationRequestSchema = baseSchema.extend({
  team: z.literal('content-creation'),
  details: contentCreationDetailsSchema,
  files: z.array(uploadedFileSchema).max(10).default([]),
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
  contentType: z.enum(ALLOWED_FILE_TYPES, {
    errorMap: () => ({ message: 'Only JPG, PNG, and PDF files are supported' }),
  }),
  size: z.number().int().min(1).max(MAX_FILE_BYTES, 'File exceeds the 100MB limit'),
})
export type SignUploadInput = z.infer<typeof signUploadSchema>
