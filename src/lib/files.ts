import { type AllowedFileType } from '@/lib/schemas/request'

/** Replaces any character that is not alphanumeric, a dot, or a hyphen. */
export function sanitizeFileName(fileName: string): string {
  return fileName
    .replace(/[^a-zA-Z0-9.-]/g, '_')
    .replace(/_{2,}/g, '_')
    .slice(-120)
}

const TYPE_BY_EXTENSION: Record<string, AllowedFileType> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
}

/**
 * The canonical mime type for a file, or null when it is not an accepted type.
 *
 * Deliberately keyed on the extension rather than the browser's `File.type`.
 * A machine without Word reports a .docx as an empty string, as
 * application/octet-stream, or as application/zip, and Storage rejects the
 * upload on whatever it is told. The extension is also the only signal the sign
 * route has, since it never sees the bytes — deriving from it on both sides
 * means the client and the server always agree, and a file named `payload.exe`
 * cannot smuggle itself through by claiming to be a PDF.
 */
export function resolveFileType(fileName: string): AllowedFileType | null {
  const extension = fileName.split('.').pop()?.toLowerCase() ?? ''

  return TYPE_BY_EXTENSION[extension] ?? null
}
