import { Badge, type BadgeProps } from '@/components/ui/badge'
import { STATUS_LABELS } from '@/lib/schemas/labels'
import type { RequestStatus } from '@/lib/schemas/request'

const VARIANTS: Record<RequestStatus, BadgeProps['variant']> = {
  pending: 'pending',
  in_progress: 'progress',
  review: 'review',
  complete: 'complete',
  cancelled: 'cancelled',
}

export function StatusBadge({
  status,
  className,
}: {
  status: RequestStatus
  className?: string
}) {
  return (
    <Badge variant={VARIANTS[status]} className={className}>
      {STATUS_LABELS[status]}
    </Badge>
  )
}
