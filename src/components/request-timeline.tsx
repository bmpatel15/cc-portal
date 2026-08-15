import { format } from 'date-fns'
import { Check, Circle, Dot } from 'lucide-react'

import { STATUS_DESCRIPTIONS, STATUS_LABELS } from '@/lib/schemas/labels'
import { STATUS_PIPELINE, type RequestStatus } from '@/lib/schemas/request'
import type { RequestStatusHistoryRow } from '@/lib/supabase/types'
import { cn } from '@/lib/utils'

/** The happy path a request walks; `cancelled` is shown only if it happened. */
const PIPELINE: RequestStatus[] = [...STATUS_PIPELINE]

export function RequestTimeline({
  status,
  history,
}: {
  status: RequestStatus
  history: RequestStatusHistoryRow[]
}) {
  const cancelled = status === 'cancelled'
  const stages: RequestStatus[] = cancelled ? [...PIPELINE.slice(0, 1), 'cancelled'] : PIPELINE
  const currentIndex = stages.indexOf(status)

  const reachedAt = new Map<RequestStatus, RequestStatusHistoryRow>()
  for (const entry of history) {
    if (!reachedAt.has(entry.to_status)) reachedAt.set(entry.to_status, entry)
  }

  return (
    <ol className="space-y-0">
      {stages.map((stage, index) => {
        const entry = reachedAt.get(stage)
        const reached = index <= currentIndex
        const active = index === currentIndex
        const isLast = index === stages.length - 1

        return (
          <li key={stage} className="flex gap-4">
            <div className="flex flex-col items-center">
              <span
                className={cn(
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
                  active && 'border-primary bg-primary text-primary-foreground',
                  reached && !active && 'border-primary bg-primary/10 text-primary',
                  !reached && 'border-border bg-background text-muted-foreground',
                  stage === 'cancelled' && reached && 'border-destructive bg-destructive/10 text-destructive',
                )}
              >
                {reached && !active ? (
                  <Check className="h-4 w-4" />
                ) : active ? (
                  <Dot className="h-6 w-6" />
                ) : (
                  <Circle className="h-2 w-2 fill-current" />
                )}
              </span>

              {!isLast ? (
                <span
                  aria-hidden
                  className={cn(
                    'my-1 w-0.5 flex-1',
                    index < currentIndex ? 'bg-primary' : 'bg-border',
                  )}
                />
              ) : null}
            </div>

            <div className={cn('pb-6', isLast && 'pb-0')}>
              <p
                className={cn(
                  'text-sm font-semibold',
                  !reached && 'text-muted-foreground',
                )}
              >
                {STATUS_LABELS[stage]}
              </p>

              {entry ? (
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {format(new Date(entry.created_at), "d MMM yyyy 'at' h:mm a")}
                </p>
              ) : null}

              {active ? (
                <p className="mt-1 text-sm text-muted-foreground">{STATUS_DESCRIPTIONS[stage]}</p>
              ) : null}

              {entry?.note ? (
                <p className="mt-2 rounded-md border bg-muted/40 px-3 py-2 text-sm">{entry.note}</p>
              ) : null}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
