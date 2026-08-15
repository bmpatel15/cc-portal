import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { format } from 'date-fns'
import { CalendarDays, FileText, Users } from 'lucide-react'

import { RequestTimeline } from '@/components/request-timeline'
import { SiteHeader } from '@/components/site-header'
import { StatusBadge } from '@/components/status-badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { TEAM_LABELS, formatDetails } from '@/lib/schemas/labels'
import { getRequestByToken } from '@/lib/requests/service'
import { referenceCode } from '@/lib/notifications/templates'

export const metadata: Metadata = {
  title: 'Track your request',
}

// Status changes must show up immediately, so never cache this page.
export const dynamic = 'force-dynamic'

export default async function TrackPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const request = await getRequestByToken(token)

  if (!request) notFound()

  const details = formatDetails(request.team, request.details)

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader subtitle={`Reference ${referenceCode(request.id)}`} />

      <main className="flex-1 bg-muted/30 py-6 sm:py-10">
        <div className="container mx-auto max-w-3xl space-y-6 px-4 sm:px-6 lg:px-8">
          <Card>
            <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:justify-between sm:p-6">
              <div className="min-w-0 space-y-1">
                <h2 className="break-anywhere text-xl font-semibold tracking-tight sm:text-2xl">
                  {request.event_name}
                </h2>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5" />
                    {TEAM_LABELS[request.team]}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <CalendarDays className="h-3.5 w-3.5" />
                    {format(new Date(request.event_datetime), "d MMM yyyy 'at' h:mm a")}
                  </span>
                </div>
              </div>

              <StatusBadge status={request.status} className="shrink-0 self-start px-3 py-1" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-base">Progress</CardTitle>
            </CardHeader>
            <CardContent>
              <RequestTimeline
                status={request.status}
                history={request.request_status_history ?? []}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-base">What you submitted</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
                <Field label="Submitted by" value={request.full_name} />
                <Field label="Department" value={request.department} />
                <Field label="Email" value={request.email} />
                {request.phone ? <Field label="Phone" value={request.phone} /> : null}
                <Field
                  label="Submitted"
                  value={format(new Date(request.created_at), "d MMM yyyy 'at' h:mm a")}
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
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                </>
              ) : null}
            </CardContent>
          </Card>

          <p className="text-center text-xs text-muted-foreground">
            Questions about this request? Reply to your confirmation email and quote reference{' '}
            <span className="font-mono font-medium">{referenceCode(request.id)}</span>.
          </p>
        </div>
      </main>
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
