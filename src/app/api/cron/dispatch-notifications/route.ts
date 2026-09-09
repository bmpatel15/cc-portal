import { NextResponse } from 'next/server'
import { getServerEnv } from '@/lib/env'
import { dispatchPending } from '@/lib/notifications/dispatch'
import { getAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Retry queued notifications.
 *
 * Scheduled by vercel.json. This is what turns delivery from best-effort into
 * eventually-reliable: anything that failed at submission time is picked up here
 * until it sends or exhausts its attempts.
 */
export async function GET(request: Request) {
  const { cronSecret } = getServerEnv()
  const authorization = request.headers.get('authorization')

  if (authorization !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
  }

  try {
    const summary = await dispatchPending()

    // Rate-limit windows are only interesting for the hour they cover, so the
    // daily tick is a free place to drop the rest. Failure here is not worth
    // failing the dispatch over -- the rows are tiny and the next run retries.
    const { error: sweepError } = await getAdminClient()
      .from('upload_rate_limit')
      .delete()
      .lt('window_start', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())

    if (sweepError) {
      console.error('Failed to sweep upload_rate_limit:', sweepError.message)
    }

    return NextResponse.json({ success: true, ...summary })
  } catch (error) {
    console.error('Notification dispatch failed:', error)
    return NextResponse.json(
      { success: false, message: 'Dispatch failed', error: String(error) },
      { status: 500 },
    )
  }
}
