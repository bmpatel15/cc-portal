'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import { SiteHeader } from '@/components/site-header'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { MIN_PASSWORD_LENGTH, passwordSchema } from '@/lib/schemas/profile'
import { getBrowserClient } from '@/lib/supabase/client'

/**
 * Sets a password on the already-authenticated user.
 *
 * Works for both cases that reach this page: someone who signed in with a link
 * and wants to stop doing that, and someone who followed a reset email — a
 * recovery link is a real session, so `updateUser` is all either needs.
 */
export function PasswordForm({ email }: { email: string }) {
  const router = useRouter()
  const [password, setPassword] = React.useState('')
  const [confirm, setConfirm] = React.useState('')
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)

    const parsed = passwordSchema.safeParse(password)
    if (!parsed.success) return setError(parsed.error.issues[0].message)
    if (password !== confirm) return setError('The two passwords do not match')

    setBusy(true)
    const { error: updateError } = await getBrowserClient().auth.updateUser({ password })
    setBusy(false)

    if (updateError) return setError(updateError.message)

    toast.success('Password saved. You can sign in with it from now on.')
    setPassword('')
    setConfirm('')
    router.push('/admin')
    router.refresh()
  }

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader title="Account" subtitle={email} />

      <main className="flex flex-1 items-center justify-center bg-muted/30 px-4 py-10">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Set a password</CardTitle>
            <CardDescription>
              Once set, you can sign in directly instead of waiting for an email link. Email links
              keep working either way.
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">New password</Label>
                <Input
                  id="password"
                  type="password"
                  required
                  minLength={MIN_PASSWORD_LENGTH}
                  autoComplete="new-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  At least {MIN_PASSWORD_LENGTH} characters.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm">Confirm password</Label>
                <Input
                  id="confirm"
                  type="password"
                  required
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(event) => setConfirm(event.target.value)}
                />
              </div>

              {error ? <p className="text-sm text-destructive">{error}</p> : null}

              <Button type="submit" className="w-full" disabled={busy}>
                {busy ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving…
                  </>
                ) : (
                  'Save password'
                )}
              </Button>

              <Button asChild variant="ghost" size="sm" className="w-full">
                <Link href="/admin">
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Back to the dashboard
                </Link>
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
