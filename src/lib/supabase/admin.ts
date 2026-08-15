import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { getPublicEnv, getServerEnv } from '@/lib/env'

/**
 * Service-role client. Bypasses RLS, so it must never be imported into a
 * client component. Used for public submission, token-based tracking lookups,
 * signed upload URLs, and the notification dispatcher.
 */

let cached: SupabaseClient | null = null

export function getAdminClient(): SupabaseClient {
  if (cached) return cached

  const { supabaseUrl } = getPublicEnv()
  const { supabaseServiceRoleKey } = getServerEnv()

  cached = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  return cached
}

export const STORAGE_BUCKET = 'cc-portal'

export function publicFileUrl(storagePath: string): string {
  const { supabaseUrl } = getPublicEnv()
  return `${supabaseUrl}/storage/v1/object/public/${STORAGE_BUCKET}/${storagePath}`
}
