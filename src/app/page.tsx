import Link from 'next/link'
import { ArrowRight, ClipboardList, LogIn, Mic, PenTool, Video } from 'lucide-react'

import { HeaderSignInButton } from '@/components/sign-in-button'
import { SiteHeader } from '@/components/site-header'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { TEAM_DESCRIPTIONS, TEAM_LABELS } from '@/lib/schemas/labels'
import { TEAMS, type Team } from '@/lib/schemas/request'

/**
 * Landing page.
 *
 * The wizard lives at /request; this sits in front of it so the first thing a
 * requester sees is what the teams do and where to sign in, rather than step one
 * of a form.
 */

const TEAM_ICONS: Record<Team, typeof Mic> = {
  audio: Mic,
  'photo-video': Video,
  'content-creation': PenTool,
}

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader
        subtitle="Need Help? Request Support from the AV &amp; Content Creation Teams"
        action={<HeaderSignInButton />}
      />

      <main className="flex-1 bg-muted/30">
        <section className="container mx-auto max-w-3xl px-4 py-14 text-center sm:px-6 sm:py-20 lg:px-8">
          <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <ClipboardList className="h-7 w-7" />
          </div>

          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Tell us what you need
          </h1>

          <p className="mx-auto mt-4 max-w-xl text-base text-muted-foreground">
            Answer a few questions about your event and the right team will pick it up. You&apos;ll
            get a tracking link so you can follow its progress from request to delivery.
          </p>

          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Button asChild size="lg">
              <Link href="/request">
                Create Request
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/login">
                <LogIn className="h-4 w-4" />
                Team sign in
              </Link>
            </Button>
          </div>
        </section>

        <section className="container mx-auto max-w-5xl px-4 pb-14 sm:px-6 sm:pb-20 lg:px-8">
          <div className="grid gap-4 sm:grid-cols-3">
            {TEAMS.map((team) => {
              const Icon = TEAM_ICONS[team]

              return (
                <Card key={team} className="h-full">
                  <CardContent className="space-y-3 p-5">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Icon className="h-5 w-5" />
                    </div>
                    <p className="font-semibold">{TEAM_LABELS[team]}</p>
                    <p className="text-sm text-muted-foreground">{TEAM_DESCRIPTIONS[team]}</p>
                  </CardContent>
                </Card>
              )
            })}
          </div>

          <p className="mt-8 text-center text-xs text-muted-foreground">
            Already submitted a request? Use the tracking link in your confirmation email to check
            its status.
          </p>
        </section>
      </main>
    </div>
  )
}
