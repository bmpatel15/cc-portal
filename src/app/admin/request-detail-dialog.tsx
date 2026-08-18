'use client'

import * as React from 'react'
import { format } from 'date-fns'
import { Clock, ExternalLink, FileText, Loader2, UserPlus } from 'lucide-react'
import { toast } from 'sonner'

import { RequestTimeline } from '@/components/request-timeline'
import { StatusBadge } from '@/components/status-badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import { displayName } from '@/lib/profiles/display'
import { STATUS_LABELS, TEAM_LABELS, formatDetails } from '@/lib/schemas/labels'
import { type RequestStatus } from '@/lib/schemas/request'
import {
  allowedNextStatuses,
  canAssign,
  canClaim,
  statusBlockReason,
  type Actor,
} from '@/lib/requests/permissions'
import { referenceCode } from '@/lib/notifications/templates'
import type { ProfileSummary, RequestWithRelations } from '@/lib/supabase/types'

import { assignRequestAction, deleteTimeEntryAction, logTimeAction, updateStatusAction } from './actions'

const UNASSIGNED = 'unassigned'

export function RequestDetailDialog({
  request,
  actor,
  staff,
  onClose,
  onUpdated,
}: {
  request: RequestWithRelations | null
  actor: Actor
  staff: ProfileSummary[]
  onClose: () => void
  onUpdated: () => void
}) {
  const [status, setStatus] = React.useState<RequestStatus | ''>('')
  const [note, setNote] = React.useState('')
  const [pending, startTransition] = React.useTransition()

  // Reset the form whenever a different request is opened, or the one on screen
  // moves. The dropdown lists only onward moves, so the current status is not a
  // valid selection — start on the placeholder.
  React.useEffect(() => {
    setStatus('')
    setNote('')
  }, [request?.id, request?.status])

  if (!request) return null

  const details = formatDetails(request.team, request.details)
  const changed = status !== '' && status !== request.status

  // The same rules the server will apply, so the panel never offers a move that
  // would come back as an error.
  const nextStatuses = allowedNextStatuses(actor, request)
  const blockReason = statusBlockReason(actor, request)
  const mayReassign = canAssign(actor, request, null).ok
  const mayClaim = canClaim(actor, request)

  function run(action: () => Promise<{ success: boolean; message: string }>, close: boolean) {
    startTransition(async () => {
      const result = await action()

      if (result.success) {
        toast.success(result.message)
        onUpdated()
        if (close) onClose()
      } else {
        toast.error(result.message)
      }
    })
  }

  function submit() {
    if (!request || !changed) return

    run(
      () =>
        updateStatusAction({
          requestId: request.id,
          status,
          note: note.trim() || undefined,
        }),
      true,
    )
  }

  function assign(assigneeId: string | null) {
    if (!request) return
    run(() => assignRequestAction({ requestId: request.id, assigneeId }), false)
  }

  return (
    <Dialog open={Boolean(request)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between gap-4 pr-6">
            <div className="min-w-0">
              <DialogTitle className="break-anywhere">{request.event_name}</DialogTitle>
              <DialogDescription>
                {TEAM_LABELS[request.team]} · Reference{' '}
                <span className="font-mono">{referenceCode(request.id)}</span>
              </DialogDescription>
            </div>
            <StatusBadge status={request.status} className="shrink-0" />
          </div>
        </DialogHeader>

        <div className="grid gap-6 lg:grid-cols-[1fr_auto_18rem]">
          <div className="space-y-5">
            <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
              <Field label="Requester" value={request.full_name} />
              <Field label="Department" value={request.department} />
              <Field label="Email" value={request.email} />
              {request.phone ? <Field label="Phone" value={request.phone} /> : null}
              <Field
                label="Event date"
                value={format(new Date(request.event_datetime), "d MMM yyyy 'at' h:mm a")}
              />
              <Field
                label="Submitted"
                value={format(new Date(request.created_at), "d MMM yyyy 'at' h:mm a")}
              />
              <Field
                label="Assigned to"
                value={
                  request.assignee
                    ? request.assigned_to === actor.id
                      ? `${displayName(request.assignee)} (you)`
                      : displayName(request.assignee)
                    : 'Unassigned'
                }
              />
            </dl>

            {details.length > 0 ? (
              <>
                <Separator />
                <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
                  {details.map((entry) => (
                    <Field key={entry.key} label={entry.label} value={entry.value} />
                  ))}
                </dl>
              </>
            ) : null}

            {request.request_files.length > 0 ? (
              <>
                <Separator />
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">Files</p>
                  <ul className="space-y-1.5">
                    {request.request_files.map((file) => (
                      <li key={file.id}>
                        <a
                          href={file.url}
                          target="_blank"
                          rel="noreferrer"
                          className="break-anywhere inline-flex items-center gap-2 text-sm font-medium text-primary underline-offset-4 hover:underline"
                        >
                          <FileText className="h-3.5 w-3.5 shrink-0" />
                          {file.name}
                          <ExternalLink className="h-3 w-3 shrink-0 opacity-60" />
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              </>
            ) : null}

            <Separator />
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">Progress</p>
              <RequestTimeline
                status={request.status}
                history={request.request_status_history ?? []}
              />
            </div>
          </div>

          <Separator orientation="vertical" className="hidden lg:block" />

          <div className="space-y-4 rounded-lg border bg-muted/30 p-4 lg:border-0 lg:bg-transparent lg:p-0">
            <div className="space-y-2">
              <p className="text-sm font-semibold">Assignment</p>

              {mayReassign ? (
                <Select
                  value={request.assigned_to ?? UNASSIGNED}
                  disabled={pending}
                  onValueChange={(value) => assign(value === UNASSIGNED ? null : value)}
                >
                  <SelectTrigger id="assignee" aria-label="Assign to">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
                    {staff.map((person) => (
                      <SelectItem key={person.id} value={person.id}>
                        {displayName(person)}
                        {person.id === actor.id ? ' (you)' : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : mayClaim ? (
                <>
                  <Button
                    variant="secondary"
                    className="w-full"
                    disabled={pending}
                    onClick={() => assign(actor.id)}
                  >
                    <UserPlus className="h-4 w-4" />
                    Claim this request
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    Claim it to take ownership and update its status.
                  </p>
                </>
              ) : (
                <p className="text-xs text-muted-foreground">
                  {request.assignee
                    ? request.assigned_to === actor.id
                      ? 'This request is yours. Ask an admin to hand it over.'
                      : `${displayName(request.assignee)} is handling this. Ask an admin to reassign it.`
                    : 'Ask an admin to assign this request.'}
                </p>
              )}
            </div>

            <Separator />

            <p className="text-sm font-semibold">Update status</p>

            {nextStatuses.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                {blockReason ?? 'There are no status changes available for this request.'}
              </p>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="status">New status</Label>
                  <Select
                    value={status}
                    onValueChange={(value) => setStatus(value as RequestStatus)}
                  >
                    <SelectTrigger id="status">
                      <SelectValue placeholder="Select a status" />
                    </SelectTrigger>
                    <SelectContent>
                      {nextStatuses.map((value) => (
                        <SelectItem key={value} value={value}>
                          {STATUS_LABELS[value]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="note">Note for the requester</Label>
                  <Textarea
                    id="note"
                    rows={4}
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    placeholder="Optional — included in the email they receive"
                  />
                </div>

                <Button className="w-full" disabled={!changed || pending} onClick={submit}>
                  {pending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Saving…
                    </>
                  ) : (
                    'Save and notify'
                  )}
                </Button>

                <p className="text-xs text-muted-foreground">
                  Saving emails the requester and adds an entry to their tracking timeline.
                </p>
              </>
            )}

            <Separator />

            <TimeLog
              request={request}
              actor={actor}
              staff={staff}
              pending={pending}
              onRun={run}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

/**
 * Hours worked on a request.
 *
 * Kept apart from the status timeline above it because the two measure
 * different things: the timeline shows elapsed time, this shows effort. A
 * request can sit for a fortnight and take twenty minutes, and the analytics
 * page reports both without ever adding them together.
 *
 * Not shown on the public tracking page — `request_time_entries` is only
 * selected on the staff paths.
 */
function TimeLog({
  request,
  actor,
  staff,
  pending,
  onRun,
}: {
  request: RequestWithRelations
  actor: Actor
  staff: ProfileSummary[]
  pending: boolean
  onRun: (
    action: () => Promise<{ success: boolean; message: string }>,
    close: boolean,
  ) => void
}) {
  const [hours, setHours] = React.useState('')
  const [workNote, setWorkNote] = React.useState('')

  React.useEffect(() => {
    setHours('')
    setWorkNote('')
  }, [request.id])

  const entries = [...(request.request_time_entries ?? [])].sort((a, b) =>
    b.worked_on.localeCompare(a.worked_on),
  )
  const total = entries.reduce((sum, entry) => sum + Number(entry.hours), 0)

  const parsed = Number(hours)
  const valid = hours.trim() !== '' && Number.isFinite(parsed) && parsed > 0

  const nameFor = (staffId: string | null) => {
    if (!staffId) return 'Removed user'
    if (staffId === actor.id) return 'You'
    const person = staff.find((candidate) => candidate.id === staffId)
    return person ? displayName(person) : 'Someone'
  }

  function submitHours() {
    onRun(
      () =>
        logTimeAction({
          requestId: request.id,
          hours: parsed,
          note: workNote.trim() || undefined,
        }),
      false,
    )
    setHours('')
    setWorkNote('')
  }

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between">
        <p className="text-sm font-semibold">Logged time</p>
        {entries.length > 0 ? (
          <span className="text-xs font-medium tabular-nums text-muted-foreground">
            {Math.round(total * 10) / 10} h total
          </span>
        ) : null}
      </div>

      {entries.length > 0 ? (
        <ul className="space-y-1.5">
          {entries.map((entry) => (
            <li key={entry.id} className="flex items-start justify-between gap-2 text-xs">
              <div className="min-w-0">
                <span className="font-medium tabular-nums">{Number(entry.hours)} h</span>
                <span className="text-muted-foreground">
                  {' · '}
                  {nameFor(entry.staff_id)}
                  {' · '}
                  {format(new Date(`${entry.worked_on}T00:00:00`), 'd MMM')}
                </span>
                {entry.note ? (
                  <p className="break-anywhere text-muted-foreground">{entry.note}</p>
                ) : null}
              </div>

              {entry.staff_id === actor.id || actor.role === 'admin' ? (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => onRun(() => deleteTimeEntryAction({ entryId: entry.id }), false)}
                  className="shrink-0 text-muted-foreground underline-offset-2 hover:text-destructive hover:underline"
                >
                  Remove
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">
          No hours logged yet. This is effort, separate from how long the request has been open.
        </p>
      )}

      <div className="flex gap-2">
        <div className="w-24 space-y-1">
          <Label htmlFor="hours" className="text-xs">
            Hours
          </Label>
          <Input
            id="hours"
            type="number"
            inputMode="decimal"
            min="0.25"
            max="24"
            step="0.25"
            value={hours}
            disabled={pending}
            onChange={(event) => setHours(event.target.value)}
            placeholder="1.5"
          />
        </div>
        <div className="flex-1 space-y-1">
          <Label htmlFor="work-note" className="text-xs">
            What was done
          </Label>
          <Input
            id="work-note"
            value={workNote}
            disabled={pending}
            onChange={(event) => setWorkNote(event.target.value)}
            placeholder="Optional"
          />
        </div>
      </div>

      <Button
        variant="secondary"
        className="w-full"
        disabled={!valid || pending}
        onClick={submitHours}
      >
        <Clock className="h-4 w-4" />
        Log time
      </Button>
    </div>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="break-anywhere text-sm font-medium">{value}</dd>
    </div>
  )
}
