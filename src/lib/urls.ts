import { getPublicEnv } from '@/lib/env'

export function trackingUrl(token: string): string {
  return `${getPublicEnv().siteUrl.replace(/\/$/, '')}/track/${token}`
}

export function adminRequestUrl(requestId: string): string {
  return `${getPublicEnv().siteUrl.replace(/\/$/, '')}/admin?request=${requestId}`
}
