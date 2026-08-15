import {
  STATUS_DESCRIPTIONS,
  STATUS_LABELS,
  TEAM_LABELS,
  formatDetails,
  formatEventDateTime,
} from '@/lib/schemas/labels'
import type { RequestDetails, RequestStatus, Team } from '@/lib/schemas/request'

/**
 * Message bodies for every notification.
 *
 * Team-specific answers are rendered by walking the validated `details` object
 * through `formatDetails`, so every question a requester answered appears — the
 * old templates hardcoded a handful of field names and printed `undefined` for
 * the rest.
 */

export interface NotificationContext {
  id: string
  fullName: string
  email: string
  phone?: string | null
  department: string
  eventName: string
  eventDateTime: string
  team: Team
  details: RequestDetails
  files: { name: string; url: string }[]
  trackingUrl: string
}

export interface RenderedMessage {
  subject: string
  text: string
  html: string
}

export function referenceCode(id: string): string {
  return id.replace(/-/g, '').slice(0, 8).toUpperCase()
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

interface Row {
  label: string
  value: string
}

function summaryRows(context: NotificationContext): Row[] {
  return [
    { label: 'Reference', value: referenceCode(context.id) },
    { label: 'Team', value: TEAM_LABELS[context.team] },
    { label: 'Event', value: context.eventName },
    { label: 'Event date', value: formatEventDateTime(context.eventDateTime) },
    { label: 'Requested by', value: context.fullName },
    { label: 'Email', value: context.email },
    ...(context.phone ? [{ label: 'Phone', value: context.phone }] : []),
    { label: 'Department', value: context.department },
  ]
}

function detailRows(context: NotificationContext): Row[] {
  return formatDetails(context.team, context.details).map(({ label, value }) => ({ label, value }))
}

function textBlock(title: string, rows: Row[]): string {
  if (rows.length === 0) return ''
  const body = rows.map((row) => `  ${row.label}: ${row.value}`).join('\n')
  return `${title}\n${body}\n`
}

function htmlTable(rows: Row[]): string {
  if (rows.length === 0) return ''
  const cells = rows
    .map(
      (row) => `
      <tr>
        <td style="padding:6px 12px 6px 0;color:#64748b;font-size:14px;vertical-align:top;white-space:nowrap;">${escapeHtml(row.label)}</td>
        <td style="padding:6px 0;color:#0f172a;font-size:14px;vertical-align:top;">${escapeHtml(row.value)}</td>
      </tr>`,
    )
    .join('')
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;">${cells}</table>`
}

function htmlShell(heading: string, intro: string, sections: string, footer: string): string {
  return `<!doctype html>
<html>
  <body style="margin:0;padding:24px;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
      <tr>
        <td style="background:#1C2127;padding:20px 24px;">
          <div style="color:#ffffff;font-size:18px;font-weight:600;">Content Request Portal</div>
        </td>
      </tr>
      <tr>
        <td style="padding:24px;">
          <h1 style="margin:0 0 8px;font-size:20px;color:#0f172a;">${escapeHtml(heading)}</h1>
          <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#475569;">${intro}</p>
          ${sections}
        </td>
      </tr>
      <tr>
        <td style="padding:16px 24px;border-top:1px solid #e2e8f0;background:#f8fafc;color:#64748b;font-size:12px;">
          ${footer}
        </td>
      </tr>
    </table>
  </body>
</html>`
}

function section(title: string, inner: string): string {
  if (!inner) return ''
  return `<h2 style="margin:20px 0 8px;font-size:13px;text-transform:uppercase;letter-spacing:.06em;color:#64748b;">${escapeHtml(title)}</h2>${inner}`
}

function button(url: string, label: string): string {
  return `<p style="margin:24px 0 0;">
    <a href="${escapeHtml(url)}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:8px;font-size:14px;font-weight:600;">${escapeHtml(label)}</a>
  </p>`
}

function filesTextBlock(context: NotificationContext): string {
  if (context.files.length === 0) return ''
  const body = context.files.map((file) => `  - ${file.name}: ${file.url}`).join('\n')
  return `Attached files\n${body}\n`
}

function filesHtmlBlock(context: NotificationContext): string {
  if (context.files.length === 0) return ''
  const items = context.files
    .map(
      (file) =>
        `<li style="margin-bottom:4px;"><a href="${escapeHtml(file.url)}" style="color:#2563eb;font-size:14px;">${escapeHtml(file.name)}</a></li>`,
    )
    .join('')
  return `<ul style="margin:0;padding-left:18px;">${items}</ul>`
}

/* -------------------------------------------------------------------------- */
/* Staff: a new request arrived                                               */
/* -------------------------------------------------------------------------- */

export function buildStaffNotification(context: NotificationContext): RenderedMessage {
  const subject = `New ${TEAM_LABELS[context.team]} request — ${context.eventName} (${referenceCode(context.id)})`

  const text = [
    'A new content request was submitted.',
    '',
    textBlock('Request', summaryRows(context)),
    textBlock('Details', detailRows(context)),
    filesTextBlock(context),
    `Open in the admin dashboard: ${context.trackingUrl}`,
  ]
    .filter(Boolean)
    .join('\n')

  const html = htmlShell(
    'New content request',
    `A new <strong>${escapeHtml(TEAM_LABELS[context.team])}</strong> request was submitted by ${escapeHtml(context.fullName)}.`,
    [
      section('Request', htmlTable(summaryRows(context))),
      section('Details', htmlTable(detailRows(context))),
      section('Files', filesHtmlBlock(context)),
      button(context.trackingUrl, 'View request'),
    ].join(''),
    'You are receiving this because you are on the content request notification list.',
  )

  return { subject, text, html }
}

/** Telegram gets the plain-text body — the Bot API call sends no HTML. */
export function buildStaffTelegramMessage(context: NotificationContext): string {
  return buildStaffNotification(context).text
}

/* -------------------------------------------------------------------------- */
/* Submitter: confirmation                                                    */
/* -------------------------------------------------------------------------- */

export function buildSubmitterConfirmation(context: NotificationContext): RenderedMessage {
  const subject = `We received your request — ${context.eventName} (${referenceCode(context.id)})`

  const text = [
    `Hi ${context.fullName},`,
    '',
    `Thanks — your ${TEAM_LABELS[context.team]} request for "${context.eventName}" has been received.`,
    '',
    textBlock('Summary', summaryRows(context)),
    textBlock('What you told us', detailRows(context)),
    filesTextBlock(context),
    `Track your request here: ${context.trackingUrl}`,
    '',
    'Keep this link — it is the quickest way to check on progress.',
  ]
    .filter(Boolean)
    .join('\n')

  const html = htmlShell(
    'Request received',
    `Thanks, ${escapeHtml(context.fullName)} — your <strong>${escapeHtml(TEAM_LABELS[context.team])}</strong> request for “${escapeHtml(context.eventName)}” has been received. You can follow its progress any time with the link below.`,
    [
      section('Summary', htmlTable(summaryRows(context))),
      section('What you told us', htmlTable(detailRows(context))),
      section('Files', filesHtmlBlock(context)),
      button(context.trackingUrl, 'Track your request'),
    ].join(''),
    'Keep this email — the tracking link above is the quickest way to check on progress.',
  )

  return { subject, text, html }
}

/* -------------------------------------------------------------------------- */
/* Submitter: status changed                                                  */
/* -------------------------------------------------------------------------- */

export function buildStatusChangeNotification(
  context: NotificationContext,
  fromStatus: RequestStatus | null,
  toStatus: RequestStatus,
  note?: string | null,
): RenderedMessage {
  const subject = `Your request is now ${STATUS_LABELS[toStatus]} — ${context.eventName} (${referenceCode(context.id)})`

  const movement = fromStatus
    ? `${STATUS_LABELS[fromStatus]} → ${STATUS_LABELS[toStatus]}`
    : STATUS_LABELS[toStatus]

  const text = [
    `Hi ${context.fullName},`,
    '',
    `Your request for "${context.eventName}" moved to ${STATUS_LABELS[toStatus]}.`,
    `${STATUS_DESCRIPTIONS[toStatus]}`,
    '',
    textBlock('Update', [
      { label: 'Reference', value: referenceCode(context.id) },
      { label: 'Status', value: movement },
      ...(note ? [{ label: 'Note from the team', value: note }] : []),
    ]),
    `Track your request here: ${context.trackingUrl}`,
  ]
    .filter(Boolean)
    .join('\n')

  const html = htmlShell(
    `Your request is now ${STATUS_LABELS[toStatus]}`,
    `${escapeHtml(STATUS_DESCRIPTIONS[toStatus])}`,
    [
      section(
        'Update',
        htmlTable([
          { label: 'Reference', value: referenceCode(context.id) },
          { label: 'Event', value: context.eventName },
          { label: 'Status', value: movement },
          ...(note ? [{ label: 'Note from the team', value: note }] : []),
        ]),
      ),
      button(context.trackingUrl, 'View status'),
    ].join(''),
    'You are receiving this because you submitted a content request.',
  )

  return { subject, text, html }
}
