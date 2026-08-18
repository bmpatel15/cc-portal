import { redirect } from 'next/navigation'
import type { Metadata } from 'next'

import { getAnalytics } from '@/lib/analytics/service'
import { analyticsFiltersSchema } from '@/lib/schemas/analytics'
import { getCurrentProfile } from '@/lib/supabase/server'

import { AnalyticsDashboard } from './analytics-dashboard'

export const metadata: Metadata = {
  title: 'Analytics',
}

// Figures must reflect the board as it stands, not as it was when the page was
// last built.
export const dynamic = 'force-dynamic'

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  // The layout gates on an active profile; analytics additionally needs admin,
  // because workload and throughput figures are management information.
  const profile = await getCurrentProfile()
  if (!profile || !profile.is_active) redirect('/login')
  if (profile.role !== 'admin') redirect('/admin')

  const params = await searchParams

  // Unparseable filters fall back to defaults rather than erroring: a stale or
  // hand-edited link should still show the dashboard.
  const parsed = analyticsFiltersSchema.safeParse(params)
  const filters = parsed.success ? parsed.data : analyticsFiltersSchema.parse({})

  const snapshot = await getAnalytics(filters)

  return <AnalyticsDashboard snapshot={snapshot} filters={filters} />
}
