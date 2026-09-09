import { getAdminClient } from '@/lib/supabase/admin'
import type { NotificationChannel, NotificationRow } from '@/lib/supabase/types'
import { sendEmail, staffEmailRecipient } from './email'
import { sendTelegramMessage, telegramRecipient } from './telegram'

/**
 * Durable notification delivery.
 *
 * Every message is written to `notification_log` as `pending` *before* any send
 * is attempted, so a failing Telegram or SMTP call can no longer take a
 * submission down with it. Delivery is attempted immediately for latency, and
 * anything still unsent is retried by the cron dispatcher.
 */

export const MAX_ATTEMPTS = 5

export interface QueuedNotification {
  requestId: string
  channel: NotificationChannel
  template: string
  recipient: string
  payload: EmailPayload | TelegramPayload
}

export interface EmailPayload {
  subject: string
  text: string
  html?: string
}

export interface TelegramPayload {
  text: string
}

/** Insert queued messages and return their rows. Never throws into the caller's happy path. */
export async function enqueueNotifications(
  notifications: QueuedNotification[],
): Promise<NotificationRow[]> {
  if (notifications.length === 0) return []

  const supabase = getAdminClient()

  const { data, error } = await supabase
    .from('notification_log')
    .insert(
      notifications.map((notification) => ({
        request_id: notification.requestId,
        channel: notification.channel,
        template: notification.template,
        recipient: notification.recipient,
        payload: notification.payload,
        status: 'pending' as const,
      })),
    )
    .select()

  if (error) throw new Error(`Failed to queue notifications: ${error.message}`)

  return (data ?? []) as NotificationRow[]
}

/**
 * Staff destinations come from configuration, so they are resolved at send time
 * rather than trusting the value stored at enqueue. A message queued while
 * `TELEGRAM_CHAT_ID` or `EMAIL_TO` was wrong then delivers correctly on retry,
 * instead of failing forever against a frozen recipient.
 *
 * Submitter recipients are deliberately not re-resolved — that address belongs
 * to the request itself.
 */
function resolveRecipient(row: NotificationRow): string {
  if (!row.template.startsWith('staff_')) return row.recipient
  return row.channel === 'telegram' ? telegramRecipient() : staffEmailRecipient()
}

/**
 * Take exclusive ownership of queue rows, and return only what this process may
 * send. A row missing from the result is being handled somewhere else -- that is
 * the point, not a failure.
 *
 * MAX_ATTEMPTS is passed in rather than left to the SQL default so the ceiling
 * has one home. The lease duration is the opposite: nothing here needs to know
 * it, so it stays in the migration.
 */
async function claimNotifications(options: {
  limit: number
  ids?: string[]
}): Promise<NotificationRow[]> {
  const { data, error } = await getAdminClient().rpc('claim_notifications', {
    p_limit: options.limit,
    p_max_attempts: MAX_ATTEMPTS,
    p_ids: options.ids ?? null,
  })

  if (error) throw new Error(`Failed to claim notifications: ${error.message}`)

  return (data ?? []) as NotificationRow[]
}

async function send(row: NotificationRow): Promise<void> {
  const recipient = resolveRecipient(row)

  if (row.channel === 'email') {
    const payload = row.payload as unknown as EmailPayload
    await sendEmail({
      to: recipient,
      subject: payload.subject,
      text: payload.text,
      html: payload.html,
    })
    return
  }

  const payload = row.payload as unknown as TelegramPayload
  await sendTelegramMessage(payload.text, recipient)
}

/**
 * Attempt one already-claimed message and record the outcome. Resolves either way.
 *
 * `attempts` is not touched: the claim incremented it, in SQL, where concurrent
 * dispatchers cannot lose the increment.
 */
export async function dispatchNotification(row: NotificationRow): Promise<boolean> {
  const supabase = getAdminClient()

  try {
    await send(row)

    await supabase
      .from('notification_log')
      .update({
        status: 'sent',
        last_error: null,
        sent_at: new Date().toISOString(),
        claimed_at: null,
      })
      .eq('id', row.id)

    return true
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`Notification ${row.id} (${row.channel}/${row.template}) failed:`, message)

    // The lease is released rather than left to expire: a failed row should be
    // retryable on the next tick instead of sitting out the rest of it.
    await supabase
      .from('notification_log')
      .update({
        status: 'failed',
        last_error: message.slice(0, 1000),
        claimed_at: null,
      })
      .eq('id', row.id)

    return false
  }
}

/**
 * Best-effort immediate delivery. Failures stay in the queue for the cron
 * dispatcher, so the caller can safely ignore the result.
 *
 * Claims first, even though it just inserted these rows. This is the *primary*
 * duplicate window, not the cron one: the insert makes a row visible to the
 * dispatcher before this line has sent it.
 */
export async function deliverNow(rows: NotificationRow[]): Promise<void> {
  if (rows.length === 0) return

  const claimed = await claimNotifications({
    limit: rows.length,
    ids: rows.map((row) => row.id),
  })

  await Promise.allSettled(claimed.map((row) => dispatchNotification(row)))
}

/** Queue and immediately attempt delivery, swallowing queue errors. */
export async function queueAndDeliver(notifications: QueuedNotification[]): Promise<void> {
  try {
    const rows = await enqueueNotifications(notifications)
    await deliverNow(rows)
  } catch (error) {
    console.error('Notification queueing failed:', error)
  }
}

export interface DispatchSummary {
  claimed: number
  sent: number
  failed: number
  exhausted: number
}

/** Retry unsent messages. Called by the cron route. */
export async function dispatchPending(limit = 25): Promise<DispatchSummary> {
  const supabase = getAdminClient()

  const rows = await claimNotifications({ limit })
  const results = await Promise.allSettled(rows.map((row) => dispatchNotification(row)))

  const sent = results.filter((result) => result.status === 'fulfilled' && result.value).length

  // Not `status = failed`: a row whose final attempt crashed mid-send is left
  // `pending` with its attempts spent, and is just as exhausted.
  const { count } = await supabase
    .from('notification_log')
    .select('id', { count: 'exact', head: true })
    .gte('attempts', MAX_ATTEMPTS)
    .neq('status', 'sent')

  return {
    claimed: rows.length,
    sent,
    failed: rows.length - sent,
    exhausted: count ?? 0,
  }
}
