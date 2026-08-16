import type { RequestDetails, RequestStatus, Team } from './request'

/**
 * Human-readable labels for every schema value.
 *
 * `formatDetails` walks whatever survived validation, so the review step, the
 * tracking timeline, and the notification templates all render the same answers
 * from one definition — no per-surface field list to fall out of sync.
 */

export const TEAM_LABELS: Record<Team, string> = {
  audio: 'Audio',
  'photo-video': 'Photo / Video',
  'content-creation': 'Content Creation',
}

/** One line per team for the landing page, drawn from what each one actually asks for. */
export const TEAM_DESCRIPTIONS: Record<Team, string> = {
  audio: 'Microphones, speakers, and sound for your event.',
  'photo-video': 'Photographers, videographers, and edited deliverables.',
  'content-creation': 'Graphics, social posts, video briefs, and print.',
}

export const STATUS_LABELS: Record<RequestStatus, string> = {
  pending: 'Pending',
  in_progress: 'In Progress',
  review: 'In Review',
  complete: 'Complete',
  cancelled: 'Cancelled',
}

export const STATUS_DESCRIPTIONS: Record<RequestStatus, string> = {
  pending: 'Your request has been received and is waiting to be picked up.',
  in_progress: 'The team is actively working on your request.',
  review: 'The work is finished and is being reviewed before delivery.',
  complete: 'Your request is complete.',
  cancelled: 'This request was cancelled.',
}

/** Question text, keyed by the field name used in the schemas. */
const FIELD_LABELS: Record<string, string> = {
  // audio
  location: 'Location',
  requiresMics: 'Microphones required',
  micType: 'Microphone type',
  handheldCount: 'Handheld mics',
  headsetCount: 'Headsets',
  wiredCount: 'Wired mics',
  requiresSpeakers: 'Speakers required',
  audioDescription: 'Additional notes',

  // photo / video
  requiresPhoto: 'Photography needed',
  photographerCount: 'Photographers required',
  photoPurpose: 'Purpose of the photography',
  photoLocation: 'Photography location and setting',
  photoDeliverables: 'Photography deliverables',
  requiresVideo: 'Videography needed',
  videographerCount: 'Videographers required',
  videoType: 'Type of video',
  videoAudience: 'Intended use and audience',
  videoLocation: 'Videography location',
  videoFormat: 'Live, recorded, or both',
  videoDeadline: 'Video deadline',

  // content creation
  contentType: 'Type of content',
  description: 'Description of what is needed',
  mobileVersion: 'Mobile version needed',
  horizontalVersion: 'Horizontal version needed',
  videoBrief: 'Video brief',
  printType: 'Type of print',
  printDescription: 'Print description',
  quantity: 'Quantity',
  width: 'Width (inches)',
  height: 'Height (inches)',
}

/** Display text for enum values, keyed by the raw stored value. */
const VALUE_LABELS: Record<string, string> = {
  yes: 'Yes',
  no: 'No',

  'main-hall': 'Main Hall',
  gym: 'Gym',
  outdoors: 'Outdoors',
  'bky-rooms': 'e/i BKY Rooms',

  wireless: 'Wireless',
  wired: 'Wired',

  'event-coverage': 'Event Coverage',
  'invited-guests': 'Invited Guests',
  other: 'Other',

  interviews: 'Interviews',
  'program-recording': 'Program Recording',

  live: 'Live Video',
  recorded: 'Recorded Video',
  both: 'Both Live and Recorded',

  graphics: 'Graphics',
  video: 'Video Creation',
  printing: 'Printing',

  'podium-banner': 'Podium Banner',
  'vinyl-banner': 'Vinyl Banner',
  'indoor-poster': 'Indoor Poster',
}

/** The order answers are presented in, per team. Unlisted keys are appended. */
const FIELD_ORDER: Record<Team, string[]> = {
  audio: [
    'location',
    'requiresMics',
    'micType',
    'handheldCount',
    'headsetCount',
    'wiredCount',
    'requiresSpeakers',
    'audioDescription',
  ],
  'photo-video': [
    'requiresPhoto',
    'photographerCount',
    'photoPurpose',
    'photoLocation',
    'photoDeliverables',
    'requiresVideo',
    'videographerCount',
    'videoType',
    'videoAudience',
    'videoLocation',
    'videoFormat',
    'videoDeadline',
  ],
  'content-creation': [
    'contentType',
    'description',
    'mobileVersion',
    'horizontalVersion',
    'videoBrief',
    'videoDeadline',
    'printType',
    'printDescription',
    'quantity',
    'width',
    'height',
  ],
}

export function fieldLabel(key: string): string {
  return FIELD_LABELS[key] ?? key
}

export function valueLabel(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  const raw = String(value)
  return VALUE_LABELS[raw] ?? raw
}

export interface DetailEntry {
  key: string
  label: string
  value: string
}

/**
 * Turn a validated `details` object into ordered, labelled entries.
 * Empty and undefined answers are omitted so conditional branches stay clean.
 */
export function formatDetails(team: Team, details: RequestDetails): DetailEntry[] {
  const record = details as Record<string, unknown>
  const order = FIELD_ORDER[team] ?? []
  const known = order.filter((key) => key in record)
  const extra = Object.keys(record).filter((key) => !order.includes(key))

  return [...known, ...extra]
    .map((key) => ({ key, label: fieldLabel(key), value: valueLabel(record[key]) }))
    .filter((entry) => entry.value !== '')
}

export function formatEventDateTime(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}
