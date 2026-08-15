'use client'

import { useFormContext } from 'react-hook-form'
import { Pencil } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { TEAM_LABELS, formatDetails, formatEventDateTime } from '@/lib/schemas/labels'
import type { RequestDetails, Team } from '@/lib/schemas/request'

import type { RequestFormValues, StepId } from '../form-model'

interface Row {
  label: string
  value: string
}

function Section({
  title,
  rows,
  onEdit,
}: {
  title: string
  rows: Row[]
  onEdit?: () => void
}) {
  if (rows.length === 0) return null

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-4">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </h3>
        {onEdit ? (
          <Button type="button" variant="ghost" size="sm" className="h-7 gap-1.5" onClick={onEdit}>
            <Pencil className="h-3 w-3" />
            Edit
          </Button>
        ) : null}
      </div>
      <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
        {rows.map((row) => (
          <div key={row.label} className="space-y-0.5">
            <dt className="text-xs text-muted-foreground">{row.label}</dt>
            <dd className="break-anywhere text-sm font-medium">{row.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

export function ReviewStep({ onEditStep }: { onEditStep: (step: StepId) => void }) {
  const form = useFormContext<RequestFormValues>()
  const values = form.watch()

  const contactRows: Row[] = [
    { label: 'Full name', value: values.fullName },
    { label: 'Email', value: values.email },
    ...(values.phone ? [{ label: 'Phone', value: values.phone }] : []),
    { label: 'Department', value: values.department },
  ].filter((row) => row.value)

  const eventRows: Row[] = [
    { label: 'Event name', value: values.eventName },
    {
      label: 'Event date and time',
      value: values.eventDateTime ? formatEventDateTime(values.eventDateTime) : '',
    },
    ...(values.team ? [{ label: 'Team', value: TEAM_LABELS[values.team as Team] }] : []),
  ].filter((row) => row.value)

  const detailRows: Row[] = values.team
    ? formatDetails(values.team as Team, values.details as unknown as RequestDetails).map(
        ({ label, value }) => ({ label, value }),
      )
    : []

  const files = values.files ?? []

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Everything below goes to the team. Check it over, then submit — you will get a confirmation
        email with a link to track progress.
      </p>

      <Separator />
      <Section title="Your information" rows={contactRows} onEdit={() => onEditStep('contact')} />

      <Separator />
      <Section title="Event" rows={eventRows} onEdit={() => onEditStep('event')} />

      {detailRows.length > 0 ? (
        <>
          <Separator />
          <Section title="Request details" rows={detailRows} onEdit={() => onEditStep('details')} />
        </>
      ) : null}

      {files.length > 0 ? (
        <>
          <Separator />
          <section className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Files
            </h3>
            <ul className="space-y-1">
              {files.map((file) => (
                <li key={file.path} className="break-anywhere text-sm font-medium">
                  {file.name}
                </li>
              ))}
            </ul>
          </section>
        </>
      ) : null}
    </div>
  )
}
