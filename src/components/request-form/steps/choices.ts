import { valueLabel } from '@/lib/schemas/labels'
import type { Choice } from '../fields'

/** Build select/radio choices from the schema's enum values, labelled centrally. */
export function choicesFrom(values: readonly string[]): Choice[] {
  return values.map((value) => ({ value, label: valueLabel(value) }))
}

export const YES_NO = choicesFrom(['yes', 'no'])

/** Wrapper for conditionally revealed questions. */
export const REVEAL_CLASS =
  'animate-in fade-in slide-in-from-top-1 duration-200 space-y-5 rounded-lg border-l-2 border-primary/30 pl-4'
