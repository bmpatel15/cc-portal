import Link from 'next/link'
import { LogIn } from 'lucide-react'

import { RequestWizard } from '@/components/request-form/request-wizard'
import { SiteHeader } from '@/components/site-header'
import { Button } from '@/components/ui/button'

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader
        subtitle="Request support from the Audio, Photo/Video, and Content Creation teams"
        action={
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="text-white/80 hover:bg-white/10 hover:text-white"
          >
            <Link href="/login">
              <LogIn className="h-4 w-4" />
              <span className="hidden sm:inline">Staff sign in</span>
            </Link>
          </Button>
        }
      />

      <main className="flex-1 bg-muted/30 py-6 sm:py-10">
        <div className="container mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <RequestWizard />

          <p className="mt-6 text-center text-xs text-muted-foreground">
            Already submitted a request? Use the tracking link in your confirmation email to check
            its status.
          </p>
        </div>
      </main>
    </div>
  )
}
