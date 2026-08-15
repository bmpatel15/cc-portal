import { z } from 'zod'

/** Roles a staff profile can hold. Mirrors the `user_role` enum in 0001_init.sql. */
export const USER_ROLES = ['admin', 'staff'] as const
export const userRoleSchema = z.enum(USER_ROLES)

/**
 * Supabase enforces its own floor (6 by default, set in Auth settings); this is
 * the stricter figure the UI asks for, and must be >= whatever Supabase accepts.
 */
export const MIN_PASSWORD_LENGTH = 8

export const passwordSchema = z
  .string()
  .min(MIN_PASSWORD_LENGTH, `Use at least ${MIN_PASSWORD_LENGTH} characters`)
  .max(72, 'Passwords are limited to 72 characters')

export const profileUpdateSchema = z.object({
  profileId: z.string().uuid(),
  role: userRoleSchema,
  isActive: z.boolean(),
})
export type ProfileUpdate = z.infer<typeof profileUpdateSchema>

/** An admin adding someone to the team. There is no self-service sign-up. */
export const inviteSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address'),
  role: userRoleSchema,
})
export type Invite = z.infer<typeof inviteSchema>
