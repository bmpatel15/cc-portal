'use client'

import * as React from 'react'

import { cn } from '@/lib/utils'

/**
 * The rounded toggle used for every filter row in the dashboard.
 *
 * Lifted out of the requests board when analytics needed the same control:
 * these chips sit on two pages that a user moves between, so a second copy
 * would drift and the drift would be visible.
 */
export function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
        active
          ? 'border-primary bg-primary text-primary-foreground'
          : 'border-input bg-background text-muted-foreground hover:bg-accent hover:text-accent-foreground',
      )}
    >
      {children}
    </button>
  )
}
