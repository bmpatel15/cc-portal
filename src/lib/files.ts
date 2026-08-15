/** Replaces any character that is not alphanumeric, a dot, or a hyphen. */
export function sanitizeFileName(fileName: string): string {
  return fileName
    .replace(/[^a-zA-Z0-9.-]/g, '_')
    .replace(/_{2,}/g, '_')
    .slice(-120)
}
