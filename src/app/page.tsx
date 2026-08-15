import { RequestWizard } from '@/components/request-form/request-wizard'
import { SiteHeader } from '@/components/site-header'

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader subtitle="Request support from the Audio, Photo/Video, and Content Creation teams" />

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
