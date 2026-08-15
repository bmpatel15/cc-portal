import { z } from 'zod'

/**
 * Environment access.
 *
 * Public values are read eagerly because Next.js inlines `process.env.NEXT_PUBLIC_*`
 * at build time — they must appear as literal member expressions to be replaced.
 *
 * Server values are validated lazily and memoised so that `next build` does not fail
 * on machines without secrets; the first runtime access throws loudly instead.
 */

/**
 * The Supabase URL must be the bare project origin. The dashboard's Data API
 * page leads with the RESTful endpoint (`https://<ref>.supabase.co/rest/v1`),
 * which is easy to copy by mistake — supabase-js appends `/rest/v1` itself, and
 * a pasted path also routes `/storage/v1/*` and `/auth/v1/*` into PostgREST.
 * Reducing to the origin makes that mistake self-correcting.
 */
const originUrl = (message: string) =>
  z
    .string()
    .url(message)
    .transform((value) => new URL(value).origin)

/** Site URL may legitimately sit under a path, so only strip trailing slashes. */
const baseUrl = (message: string) =>
  z
    .string()
    .url(message)
    .transform((value) => value.replace(/\/+$/, ''))

const publicSchema = z.object({
  supabaseUrl: originUrl('NEXT_PUBLIC_SUPABASE_URL must be a valid URL'),
  supabaseAnonKey: z.string().min(1, 'NEXT_PUBLIC_SUPABASE_ANON_KEY is required'),
  siteUrl: baseUrl('NEXT_PUBLIC_SITE_URL must be a valid URL'),
})

const serverSchema = z.object({
  supabaseServiceRoleKey: z.string().min(1, 'SUPABASE_SERVICE_ROLE_KEY is required'),
  telegramBotToken: z.string().min(1, 'TELEGRAM_BOT_TOKEN is required'),
  telegramChatId: z.string().min(1, 'TELEGRAM_CHAT_ID is required'),
  email: z.object({
    host: z.string().min(1, 'EMAIL_HOST is required'),
    port: z.coerce.number().int().positive('EMAIL_PORT must be a positive integer'),
    secure: z
      .string()
      .optional()
      .transform((value) => value === 'true'),
    user: z.string().min(1, 'EMAIL_USER is required'),
    pass: z.string().min(1, 'EMAIL_PASS is required'),
    from: z.string().min(1, 'EMAIL_FROM is required'),
    to: z.string().min(1, 'EMAIL_TO is required'),
  }),
  cronSecret: z.string().min(16, 'CRON_SECRET must be at least 16 characters'),
})

export type PublicEnv = z.infer<typeof publicSchema>
export type ServerEnv = z.infer<typeof serverSchema>

function format(error: z.ZodError): never {
  const details = error.issues
    .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
    .join('\n')
  throw new Error(`Invalid environment configuration:\n${details}`)
}

let publicCache: PublicEnv | null = null

export function getPublicEnv(): PublicEnv {
  if (publicCache) return publicCache

  const parsed = publicSchema.safeParse({
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    siteUrl: process.env.NEXT_PUBLIC_SITE_URL,
  })

  if (!parsed.success) format(parsed.error)

  publicCache = parsed.data
  return publicCache
}

let serverCache: ServerEnv | null = null

export function getServerEnv(): ServerEnv {
  if (serverCache) return serverCache

  const parsed = serverSchema.safeParse({
    supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    telegramBotToken: process.env.TELEGRAM_BOT_TOKEN,
    telegramChatId: process.env.TELEGRAM_CHAT_ID,
    email: {
      host: process.env.EMAIL_HOST,
      port: process.env.EMAIL_PORT,
      secure: process.env.EMAIL_SECURE,
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
      from: process.env.EMAIL_FROM,
      to: process.env.EMAIL_TO,
    },
    cronSecret: process.env.CRON_SECRET,
  })

  if (!parsed.success) format(parsed.error)

  serverCache = parsed.data
  return serverCache
}
