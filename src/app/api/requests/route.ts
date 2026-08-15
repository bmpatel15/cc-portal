import { NextResponse } from 'next/server'
import { ZodError } from 'zod'
import { requestSchema } from '@/lib/schemas/request'
import { createRequest } from '@/lib/requests/service'

export const runtime = 'nodejs'

/**
 * Submit a content request.
 *
 * The body is JSON — files are uploaded straight to Supabase Storage with signed
 * URLs beforehand, so nothing large streams through this function.
 */
export async function POST(request: Request) {
  let body: unknown

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, message: 'Expected a JSON body' }, { status: 400 })
  }

  const parsed = requestSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      {
        success: false,
        message: 'Some answers need attention',
        errors: fieldErrors(parsed.error),
      },
      { status: 422 },
    )
  }

  try {
    const created = await createRequest(parsed.data)

    return NextResponse.json({
      success: true,
      message: 'Request submitted',
      id: created.id,
      trackingToken: created.trackingToken,
      trackingUrl: created.trackingUrl,
    })
  } catch (error) {
    console.error('Failed to create request:', error)

    return NextResponse.json(
      {
        success: false,
        message: 'We could not save your request. Please try again.',
        error: process.env.NODE_ENV === 'development' ? String(error) : undefined,
      },
      { status: 500 },
    )
  }
}

function fieldErrors(error: ZodError): { path: string; message: string }[] {
  return error.issues.map((issue) => ({
    path: issue.path.join('.'),
    message: issue.message,
  }))
}
