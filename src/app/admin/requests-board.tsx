'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { Inbox, Search } from 'lucide-react'

import { StatusBadge } from '@/components/status-badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { displayName } from '@/lib/profiles/display'
import type { Actor } from '@/lib/requests/permissions'
import { STATUS_LABELS, TEAM_LABELS } from '@/lib/schemas/labels'
import {
  isClosed,
  REQUEST_STATUSES,
  TEAMS,
  type RequestStatus,
  type Team,
} from '@/lib/schemas/request'
import type { ProfileSummary, RequestWithRelations } from '@/lib/supabase/types'
import { cn } from '@/lib/utils'

import { RequestDetailDialog } from './request-detail-dialog'

/**
 * `open` is everything still needing work, and it is where the board starts.
 * Completed and cancelled requests are kept — the history matters, and an admin
 * can reopen either — but they are not work, so they only appear when asked for.
 */
type StatusFilter = RequestStatus | 'all' | 'open'
type OwnerFilter = 'all' | 'mine' | 'unassigned'

export function RequestsBoard({
  requests,
  actor,
  staff,
  initialRequestId,
}: {
  requests: RequestWithRelations[]
  actor: Actor
  staff: ProfileSummary[]
  initialRequestId: string | null
}) {
  const router = useRouter()
  const [status, setStatus] = React.useState<StatusFilter>('open')
  const [team, setTeam] = React.useState<Team | 'all'>('all')
  const [owner, setOwner] = React.useState<OwnerFilter>('all')
  const [search, setSearch] = React.useState('')
  const [selectedId, setSelectedId] = React.useState<string | null>(initialRequestId)

  const counts = React.useMemo(() => {
    const base: Record<StatusFilter, number> = {
      all: requests.length,
      open: 0,
      pending: 0,
      in_progress: 0,
      review: 0,
      complete: 0,
      cancelled: 0,
    }
    for (const request of requests) {
      base[request.status] += 1
      if (!isClosed(request.status)) base.open += 1
    }
    return base
  }, [requests])

  const matchesStatus = React.useCallback(
    (request: RequestWithRelations) => {
      if (status === 'all') return true
      if (status === 'open') return !isClosed(request.status)
      return request.status === status
    },
    [status],
  )

  // Scoped to the status filter, so "Unassigned (3)" cannot promise three pieces
  // of work when two of them are finished.
  const ownerCounts = React.useMemo(() => {
    const inScope = requests.filter(matchesStatus)

    return {
      mine: inScope.filter((request) => request.assigned_to === actor.id).length,
      unassigned: inScope.filter((request) => !request.assigned_to).length,
    }
  }, [requests, matchesStatus, actor.id])

  const visible = React.useMemo(() => {
    const term = search.trim().toLowerCase()

    return requests.filter((request) => {
      if (!matchesStatus(request)) return false
      if (team !== 'all' && request.team !== team) return false
      if (owner === 'mine' && request.assigned_to !== actor.id) return false
      if (owner === 'unassigned' && request.assigned_to) return false
      if (!term) return true

      return [request.event_name, request.full_name, request.email, request.department]
        .join(' ')
        .toLowerCase()
        .includes(term)
    })
  }, [requests, matchesStatus, team, owner, search, actor.id])

  const selected = requests.find((request) => request.id === selectedId) ?? null

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {(['pending', 'in_progress', 'review', 'complete'] as RequestStatus[]).map((key) => (
          <Card
            key={key}
            role="button"
            tabIndex={0}
            onClick={() => setStatus(status === key ? 'open' : key)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                setStatus(status === key ? 'open' : key)
              }
            }}
            className={cn(
              'cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-md',
              status === key && 'ring-2 ring-primary',
            )}
          >
            <CardContent className="p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {STATUS_LABELS[key]}
              </p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">{counts[key]}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="space-y-4 p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search event, name, email, or department"
                className="pl-9"
              />
            </div>

            <div className="flex flex-wrap gap-1.5">
              <FilterChip active={team === 'all'} onClick={() => setTeam('all')}>
                All teams
              </FilterChip>
              {TEAMS.map((value) => (
                <FilterChip key={value} active={team === value} onClick={() => setTeam(value)}>
                  {TEAM_LABELS[value]}
                </FilterChip>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5">
            <FilterChip active={owner === 'all'} onClick={() => setOwner('all')}>
              Everyone
            </FilterChip>
            <FilterChip active={owner === 'mine'} onClick={() => setOwner('mine')}>
              Mine ({ownerCounts.mine})
            </FilterChip>
            <FilterChip active={owner === 'unassigned'} onClick={() => setOwner('unassigned')}>
              Unassigned ({ownerCounts.unassigned})
            </FilterChip>
          </div>

          <div className="flex flex-wrap gap-1.5">
            <FilterChip active={status === 'open'} onClick={() => setStatus('open')}>
              Open ({counts.open})
            </FilterChip>
            {REQUEST_STATUSES.map((value) => (
              <FilterChip key={value} active={status === value} onClick={() => setStatus(value)}>
                {STATUS_LABELS[value]} ({counts[value]})
              </FilterChip>
            ))}
            <FilterChip active={status === 'all'} onClick={() => setStatus('all')}>
              All ({counts.all})
            </FilterChip>
          </div>

          {visible.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-14 text-center">
              <Inbox className="h-8 w-8 text-muted-foreground" />
              {status === 'open' && counts.open === 0 && counts.all > 0 ? (
                <>
                  <p className="text-sm font-medium">Nothing open right now</p>
                  <p className="text-xs text-muted-foreground">
                    Every request has been completed or cancelled — pick All to see them.
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm font-medium">No requests match these filters</p>
                  <p className="text-xs text-muted-foreground">
                    Try clearing the search or picking a different status.
                  </p>
                </>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Event</TableHead>
                  <TableHead className="hidden md:table-cell">Requester</TableHead>
                  <TableHead className="hidden sm:table-cell">Team</TableHead>
                  <TableHead className="hidden lg:table-cell">Event date</TableHead>
                  <TableHead className="hidden md:table-cell">Assignee</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-0" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((request) => (
                  <TableRow
                    key={request.id}
                    className="cursor-pointer"
                    onClick={() => setSelectedId(request.id)}
                  >
                    <TableCell className="max-w-[16rem]">
                      <p className="truncate font-medium">{request.event_name}</p>
                      <p className="truncate text-xs text-muted-foreground md:hidden">
                        {request.full_name}
                      </p>
                    </TableCell>
                    <TableCell className="hidden max-w-[14rem] md:table-cell">
                      <p className="truncate">{request.full_name}</p>
                      <p className="truncate text-xs text-muted-foreground">{request.department}</p>
                    </TableCell>
                    <TableCell className="hidden whitespace-nowrap text-muted-foreground sm:table-cell">
                      {TEAM_LABELS[request.team]}
                    </TableCell>
                    <TableCell className="hidden whitespace-nowrap text-muted-foreground lg:table-cell">
                      {format(new Date(request.event_datetime), 'd MMM yyyy')}
                    </TableCell>
                    <TableCell className="hidden max-w-[10rem] md:table-cell">
                      {request.assignee ? (
                        <span className="truncate">
                          {request.assigned_to === actor.id ? 'You' : displayName(request.assignee)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">Unassigned</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={request.status} />
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(event) => {
                          event.stopPropagation()
                          setSelectedId(request.id)
                        }}
                      >
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <RequestDetailDialog
        request={selected}
        actor={actor}
        staff={staff}
        onClose={() => setSelectedId(null)}
        onUpdated={() => router.refresh()}
      />
    </div>
  )
}

function FilterChip({
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
