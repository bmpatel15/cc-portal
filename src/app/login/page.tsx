'use client'

import * as React from 'react'
import { Loader2, Mail } from 'lucide-react'

import { SiteHeader } from '@/components/site-header'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { getBrowserClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const [email, setEmail] = React.useState('')
  const [status, setStatus] = React.useState<'idle' | 'sending' | 'sent'>('idle')
  const [error, setError] = React.useState<string | null>(null)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setStatus('sending')
    setError(null)

    const { error: signInError } = await getBrowserClient().auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    if (signInError) {
      setError(signInError.message)
      setStatus('idle')
      return
    }

    setStatus('sent')
  }

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader subtitle="Staff sign in" />

      <main className="flex flex-1 items-center justify-center bg-muted/30 px-4 py-10">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Staff sign in</CardTitle>
            <CardDescription>
              We&apos;ll email you a sign-in link. Only accounts with staff access can open the
              dashboard.
            </CardDescription>
          </CardHeader>

          <CardContent>
            {status === 'sent' ? (
              <div className="space-y-3 rounded-lg border bg-muted/40 p-4 text-center">
                <Mail className="mx-auto h-6 w-6 text-primary" />
                <p className="text-sm font-medium">Check your inbox</p>
                <p className="text-sm text-muted-foreground">
                  We sent a sign-in link to <span className="font-medium">{email}</span>.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Work email</Label>
                  <Input
                    id="email"
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="you@example.org"
                  />
                </div>

                {error ? <p className="text-sm text-destructive">{error}</p> : null}

                <Button type="submit" className="w-full" disabled={status === 'sending'}>
                  {status === 'sending' ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Sending…
                    </>
                  ) : (
                    'Email me a sign-in link'
                  )}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
