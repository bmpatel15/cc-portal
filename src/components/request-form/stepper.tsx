'use client'

import { Check } from 'lucide-react'

import { cn } from '@/lib/utils'

import { STEPS, type StepId } from './form-model'

export function Stepper({
  current,
  furthest,
  onSelect,
}: {
  current: number
  furthest: number
  onSelect: (id: StepId) => void
}) {
  return (
    <nav aria-label="Progress" className="w-full">
      <ol className="flex items-center">
        {STEPS.map((step, index) => {
          const complete = index < furthest
          const active = index === current
          const reachable = index <= furthest
          const isLast = index === STEPS.length - 1

          return (
            <li key={step.id} className={cn('flex items-center', !isLast && 'flex-1')}>
              <button
                type="button"
                disabled={!reachable}
                onClick={() => reachable && onSelect(step.id)}
                aria-current={active ? 'step' : undefined}
                className={cn(
                  'flex shrink-0 items-center gap-2 rounded-md py-1 pr-1 transition-opacity',
                  reachable ? 'cursor-pointer' : 'cursor-default opacity-50',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                )}
              >
                <span
                  className={cn(
                    'flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold transition-colors',
                    active && 'border-primary bg-primary text-primary-foreground',
                    complete && !active && 'border-primary bg-primary/10 text-primary',
                    !active && !complete && 'border-input bg-background text-muted-foreground',
                  )}
                >
                  {complete && !active ? <Check className="h-3.5 w-3.5" /> : index + 1}
                </span>
                <span
                  className={cn(
                    'hidden text-xs font-medium sm:inline',
                    active ? 'text-foreground' : 'text-muted-foreground',
                  )}
                >
                  {step.shortTitle}
                </span>
              </button>

              {!isLast ? (
                <span
                  aria-hidden
                  className={cn(
                    'mx-2 h-px flex-1 transition-colors',
                    index < furthest ? 'bg-primary' : 'bg-border',
                  )}
                />
              ) : null}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
