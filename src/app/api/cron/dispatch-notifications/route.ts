import { NextResponse } from 'next/server'
import { getServerEnv } from '@/lib/env'
import { dispatchPending } from '@/lib/notifications/dispatch'

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
    return NextResponse.json({ success: true, ...summary })
  } catch (error) {
    console.error('Notification dispatch failed:', error)
    return NextResponse.json(
      { success: false, message: 'Dispatch failed', error: String(error) },
      { status: 500 },
    )
  }
}
