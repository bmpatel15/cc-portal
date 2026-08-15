'use client'

import { Camera, Mic, Palette } from 'lucide-react'
import { useFormContext } from 'react-hook-form'

import { FormField, FormItem, FormMessage } from '@/components/ui/form'
import { TEAMS, type Team } from '@/lib/schemas/request'
import { TEAM_LABELS } from '@/lib/schemas/labels'
import { cn } from '@/lib/utils'

import type { RequestFormValues } from '../form-model'

const TEAM_META: Record<Team, { icon: typeof Mic; blurb: string }> = {
  audio: {
    icon: Mic,
    blurb: 'Microphones, speakers, and sound for your event.',
  },
  'photo-video': {
    icon: Camera,
    blurb: 'Photographers and videographers to cover your event.',
  },
  'content-creation': {
    icon: Palette,
    blurb: 'Graphics, video production, and printed materials.',
  },
}

export function TeamStep() {
  const form = useFormContext<RequestFormValues>()

  return (
    <FormField
      control={form.control}
      name="team"
      render={({ field }) => (
        <FormItem>
          <div
            role="radiogroup"
            aria-label="Which team do you need?"
            className="grid gap-3 sm:grid-cols-3"
          >
            {TEAMS.map((team) => {
              const { icon: Icon, blurb } = TEAM_META[team]
              const selected = field.value === team

              return (
                <button
                  key={team}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => {
                    form.clearErrors()
                    // Answers from another branch would fail that team's schema.
                    if (field.value !== team) form.setValue('details', {})
                    field.onChange(team)
                  }}
                  className={cn(
                    'group flex flex-col items-center gap-3 rounded-xl border bg-card p-6 text-center transition-all',
                    'hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-md',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    selected && 'border-primary bg-primary/5 shadow-sm ring-1 ring-primary',
                  )}
                >
                  <span
                    className={cn(
                      'flex h-12 w-12 items-center justify-center rounded-full transition-colors',
                      selected
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary',
                    )}
                  >
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="font-semibold">{TEAM_LABELS[team]}</span>
                  <span className="text-xs leading-relaxed text-muted-foreground">{blurb}</span>
                </button>
              )
            })}
          </div>
          <FormMessage />
        </FormItem>
      )}
    />
  )
}
