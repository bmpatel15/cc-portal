import type { Metadata } from 'next'

import { RequestWizard } from '@/components/request-form/request-wizard'
import { HeaderSignInButton } from '@/components/sign-in-button'
import { SiteHeader } from '@/components/site-header'

export const metadata: Metadata = {
  title: 'New request',
}

export default function RequestPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader
        subtitle="Need Help? Request Support from the AV &amp; Content Creation Teams"
        action={<HeaderSignInButton />}
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
