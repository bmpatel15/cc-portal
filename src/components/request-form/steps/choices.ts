import { valueLabel } from '@/lib/schemas/labels'
import type { Choice } from '../fields'

/** Build select/radio choices from the schema's enum values, labelled centrally. */
export function choicesFrom(values: readonly string[]): Choice[] {
  return values.map((value) => ({ value, label: valueLabel(value) }))
}

export const YES_NO = choicesFrom(['yes', 'no'])

/**
 * 1..max as select choices.
 *
 * A crew of at most a handful is quicker to pick than to type, and a dropdown
 * cannot be handed a number the team could never staff.
 */
export function countChoices(max: number): Choice[] {
  return Array.from({ length: max }, (_, index) => ({
    value: String(index + 1),
    label: String(index + 1),
  }))
}

/** Wrapper for conditionally revealed questions. */
export const REVEAL_CLASS =
  'animate-in fade-in slide-in-from-top-1 duration-200 space-y-5 rounded-lg border-l-2 border-primary/30 pl-4'
