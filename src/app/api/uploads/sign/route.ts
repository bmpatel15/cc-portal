import { NextResponse } from 'next/server'
import { signUploadSchema } from '@/lib/schemas/request'
import { STORAGE_BUCKET, getAdminClient } from '@/lib/supabase/admin'
import { sanitizeFileName } from '@/lib/files'

export const runtime = 'nodejs'

/**
 * Mint a short-lived signed upload URL so the browser can PUT the file straight
 * to Supabase Storage. Keeps 100MB payloads out of the serverless function
 * entirely — the old route streamed every byte through Next.
 */
export async function POST(request: Request) {
  let body: unknown

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, message: 'Expected a JSON body' }, { status: 400 })
  }

  const parsed = signUploadSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { success: false, message: parsed.error.issues[0]?.message ?? 'Invalid file' },
      { status: 422 },
    )
  }

  const { fileName, contentType } = parsed.data
  const path = `files/${Date.now()}_${crypto.randomUUID().slice(0, 8)}_${sanitizeFileName(fileName)}`

  const { data, error } = await getAdminClient()
    .storage.from(STORAGE_BUCKET)
    .createSignedUploadUrl(path)

  if (error || !data) {
    console.error('Failed to create signed upload URL:', error)
    return NextResponse.json(
      { success: false, message: 'Could not prepare the upload. Please try again.' },
      { status: 500 },
    )
  }

  return NextResponse.json({
    success: true,
    path: data.path,
    token: data.token,
    signedUrl: data.signedUrl,
    contentType,
  })
}
