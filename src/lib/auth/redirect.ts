/**
 * Only same-site paths may be followed after an emailed auth link.
 *
 * `next` arrives in a link that lands in someone's inbox, so it is attacker-
 * controllable. A leading `//` (or `/\`) is protocol-relative and would send the
 * browser to another host once joined to the origin.
 */
export function safeNext(next: string | null, fallback = '/admin'): string {
  if (!next || !next.startsWith('/')) return fallback
  if (next.startsWith('//') || next.startsWith('/\\')) return fallback
  return next
}
