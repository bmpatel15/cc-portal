import { getServerEnv } from '@/lib/env'

/**
 * Telegram delivery over the plain Bot API.
 *
 * `node-telegram-bot-api` was pulling in a polling/webhook stack plus a legacy
 * request client for what is a single POST, so it was dropped.
 */

const TELEGRAM_API = 'https://api.telegram.org'

export async function sendTelegramMessage(text: string, chatId?: string): Promise<void> {
  const { telegramBotToken, telegramChatId } = getServerEnv()

  const response = await fetch(`${TELEGRAM_API}/bot${telegramBotToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId ?? telegramChatId,
      text,
      disable_web_page_preview: true,
    }),
    // Never let a hung Telegram call stall a submission response.
    signal: AbortSignal.timeout(10_000),
  })

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new Error(`Telegram API responded ${response.status}: ${body.slice(0, 300)}`)
  }

  const result = (await response.json()) as { ok?: boolean; description?: string }
  if (!result.ok) {
    throw new Error(`Telegram API rejected the message: ${result.description ?? 'unknown error'}`)
  }
}

export function telegramRecipient(): string {
  return getServerEnv().telegramChatId
}
