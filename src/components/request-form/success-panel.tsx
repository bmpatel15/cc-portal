'use client'

import * as React from 'react'
import Link from 'next/link'
import { ArrowRight, Check, Copy, PartyPopper } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

export function SuccessPanel({
  trackingUrl,
  reference,
  email,
  onReset,
}: {
  trackingUrl: string
  reference: string
  email: string
  onReset: () => void
}) {
  const [copied, setCopied] = React.useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(trackingUrl)
      setCopied(true)
      toast.success('Tracking link copied')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Could not copy the link')
    }
  }

  return (
    <Card className="border-none shadow-lg">
      <CardContent className="space-y-6 p-6 text-center sm:p-10">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
          <PartyPopper className="h-6 w-6" />
        </div>

        <div className="space-y-2">
          <h2 className="text-2xl font-semibold tracking-tight">Request submitted</h2>
          <p className="mx-auto max-w-md text-sm text-muted-foreground">
            Reference <span className="font-mono font-semibold text-foreground">{reference}</span>.
            We sent a confirmation to{' '}
            <span className="break-anywhere font-medium text-foreground">{email}</span> with the
            link below.
          </p>
        </div>

        <div className="mx-auto flex max-w-lg flex-col gap-2 rounded-lg border bg-muted/40 p-3 sm:flex-row sm:items-center">
          <code className="break-anywhere flex-1 text-left text-xs text-muted-foreground">
            {trackingUrl}
          </code>
          <Button type="button" variant="outline" size="sm" onClick={copy} className="shrink-0">
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? 'Copied' : 'Copy link'}
          </Button>
        </div>

        <div className="flex flex-col justify-center gap-2 sm:flex-row">
          <Button asChild>
            <Link href={trackingUrl}>
              Track your request
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <Button type="button" variant="outline" onClick={onReset}>
            Submit another request
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
