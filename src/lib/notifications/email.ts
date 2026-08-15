import nodemailer, { type Transporter } from 'nodemailer'
import { getServerEnv } from '@/lib/env'

/**
 * One transporter for the process, not one per request. Nodemailer pools the
 * SMTP connection, so rebuilding it on every submission (as the old route did)
 * paid a full handshake each time.
 */

let transporter: Transporter | null = null

function getTransporter(): Transporter {
  if (transporter) return transporter

  const { email } = getServerEnv()

  transporter = nodemailer.createTransport({
    host: email.host,
    port: email.port,
    secure: email.secure,
    auth: {
      user: email.user,
      pass: email.pass,
    },
    pool: true,
    maxConnections: 3,
  })

  return transporter
}

export interface EmailMessage {
  to: string
  subject: string
  text: string
  html?: string
}

export async function sendEmail(message: EmailMessage): Promise<void> {
  const { email } = getServerEnv()

  await getTransporter().sendMail({
    from: email.from,
    to: message.to,
    subject: message.subject,
    text: message.text,
    html: message.html,
  })
}

/** Where staff notifications go. */
export function staffEmailRecipient(): string {
  return getServerEnv().email.to
}
