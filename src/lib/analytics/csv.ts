/**
 * CSV serialisation for the analytics download.
 *
 * Hand-rolled rather than pulled from a dependency: a correct writer is short,
 * and the two things that actually matter here — RFC 4180 quoting and formula
 * injection — are worth having in front of us rather than trusting to a
 * transitive update.
 */

/**
 * Characters that make a spreadsheet treat a cell as a formula.
 *
 * `department` and `event_name` are free text typed by anyone who can reach the
 * public request form, so a cell beginning `=HYPERLINK(...)` is a realistic
 * thing to receive. Excel and Sheets will execute it on open, which turns an
 * export into a delivery mechanism. Prefixing with an apostrophe forces the
 * cell to text and displays unchanged.
 */
const FORMULA_PREFIXES = ['=', '+', '-', '@', '\t', '\r']

function neutralise(value: string): string {
  if (value.length > 0 && FORMULA_PREFIXES.includes(value[0])) return `'${value}`
  return value
}

/** One field, quoted only when it has to be. */
export function escapeField(value: unknown): string {
  if (value === null || value === undefined) return ''

  const raw = value instanceof Date ? value.toISOString() : String(value)
  const safe = neutralise(raw)

  // A field containing a delimiter, a quote, or a newline must be quoted, and
  // embedded quotes doubled.
  if (/[",\r\n]/.test(safe)) return `"${safe.replaceAll('"', '""')}"`
  return safe
}

export function toCsv(headers: readonly string[], rows: readonly unknown[][]): string {
  const lines = [headers.map(escapeField).join(',')]

  for (const row of rows) {
    lines.push(row.map(escapeField).join(','))
  }

  // CRLF per RFC 4180, and a BOM so Excel opens UTF-8 department names without
  // mangling them — the header is written by the caller alongside this.
  return lines.join('\r\n')
}

/** Excel needs a BOM to read a UTF-8 CSV as UTF-8 rather than as its own locale. */
export const UTF8_BOM = '﻿'

/**
 * A filename-safe slug for the download.
 *
 * Anything a browser or filesystem might argue about is replaced, and the
 * result is bounded so a long department filter cannot produce a name that some
 * systems refuse to save.
 */
export function filenameSlug(parts: readonly (string | null | undefined)[]): string {
  return parts
    .filter((part): part is string => Boolean(part && part.trim()))
    .join('-')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}
