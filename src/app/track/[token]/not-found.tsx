import Link from 'next/link'
import { SearchX } from 'lucide-react'

import { SiteHeader } from '@/components/site-header'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

export default function TrackNotFound() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />

      <main className="flex flex-1 items-center justify-center bg-muted/30 px-4 py-10">
        <Card className="w-full max-w-md">
          <CardContent className="space-y-4 p-8 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <SearchX className="h-5 w-5" />
            </div>
            <h2 className="text-xl font-semibold tracking-tight">Request not found</h2>
            <p className="text-sm text-muted-foreground">
              This tracking link is not valid. Check the link in your confirmation email — it may
              have been truncated.
            </p>
            <Button asChild variant="outline">
              <Link href="/">Submit a new request</Link>
            </Button>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
