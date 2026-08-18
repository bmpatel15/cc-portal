import { NextResponse } from 'next/server'
import { ALLOWED_FILE_LABEL, signUploadSchema } from '@/lib/schemas/request'
import { STORAGE_BUCKET, getAdminClient } from '@/lib/supabase/admin'
import { resolveFileType, sanitizeFileName } from '@/lib/files'

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

  const { fileName } = parsed.data

  // Derived from the name, never from the client's claim: this route is
  // unauthenticated, so a supplied contentType proves nothing about the file it
  // names, and the browser's own value is unreliable for Word documents anyway.
  const contentType = resolveFileType(fileName)

  if (!contentType) {
    return NextResponse.json(
      { success: false, message: `Upload a ${ALLOWED_FILE_LABEL} file` },
      { status: 422 },
    )
  }

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
