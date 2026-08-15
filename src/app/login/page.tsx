'use client'

import * as React from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Clock, Loader2, Mail } from 'lucide-react'

import { SiteHeader } from '@/components/site-header'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { MIN_PASSWORD_LENGTH } from '@/lib/schemas/profile'
import { getBrowserClient } from '@/lib/supabase/client'

/**
 * Two ways in, because accounts are not created here.
 *
 * A new staff member is only ever bootstrapped by an email link — there is no
 * public sign-up — and sets a password afterwards from /account/password. So the
 * link flow has to stay, but anyone who has set a password can skip the round
 * trip through their inbox.
 */
type Mode = 'password' | 'link'

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader subtitle="Staff sign in" />

      <main className="flex flex-1 items-center justify-center bg-muted/30 px-4 py-10">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Staff sign in</CardTitle>
            <CardDescription>
              Only approved staff accounts can open the dashboard.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {/* useSearchParams needs a boundary so the page can still prerender. */}
            <React.Suspense fallback={null}>
              <LoginNotices />
            </React.Suspense>
            <SignInForm />
          </CardContent>
        </Card>
      </main>
    </div>
  )
}

/** Whatever the redirect that landed here wants to say: awaiting approval, or a failed link. */
function LoginNotices() {
  const params = useSearchParams()
  const callbackError = params.get('error')

  if (params.get('pending') === '1') {
    return (
      <div className="flex gap-3 rounded-lg border bg-muted/40 p-4">
        <Clock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        <div className="space-y-1">
          <p className="text-sm font-medium">Your account is waiting for approval</p>
          <p className="text-sm text-muted-foreground">
            You&apos;re signed in, but an admin needs to grant you dashboard access before you can
            see requests.
          </p>
        </div>
      </div>
    )
  }

  if (callbackError) {
    return (
      <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4">
        <p className="text-sm font-medium text-destructive">That link didn&apos;t work</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {callbackError === 'missing_code'
            ? 'It looks incomplete — request a fresh one below.'
            : 'It may have expired or already been used. Request a fresh one below.'}
        </p>
      </div>
    )
  }

  return null
}

function SignInForm() {
  const router = useRouter()
  const [mode, setMode] = React.useState<Mode>('password')
  const [email, setEmail] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [busy, setBusy] = React.useState(false)
  const [sent, setSent] = React.useState<'link' | 'reset' | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  function callbackUrl(next?: string) {
    const base = `${window.location.origin}/auth/callback`
    return next ? `${base}?next=${encodeURIComponent(next)}` : base
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)

    const supabase = getBrowserClient()

    if (mode === 'link') {
      const { error: linkError } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: callbackUrl(),
          // Accounts are created by admin invitation only. Without this the link
          // form would quietly register any address that asked.
          shouldCreateUser: false,
        },
      })

      setBusy(false)
      if (linkError) {
        return setError(
          /signups not allowed|not found/i.test(linkError.message)
            ? 'No account exists for that address. Ask an admin to invite you.'
            : linkError.message,
        )
      }
      return setSent('link')
    }

    const { error: passwordError } = await supabase.auth.signInWithPassword({ email, password })

    if (passwordError) {
      setBusy(false)
      // Supabase returns the same message for a wrong password and an unknown
      // address, on purpose — do not narrow it down for the caller.
      setError(
        passwordError.message === 'Invalid login credentials'
          ? 'That email and password combination is not recognised. If you have never set a password, sign in with an email link instead.'
          : passwordError.message,
      )
      return
    }

    // The server components behind /admin read the session from cookies, so the
    // refresh matters as much as the push.
    router.push('/admin')
    router.refresh()
  }

  async function sendReset() {
    if (!email) return setError('Enter your email address first, then choose Forgot password.')

    setBusy(true)
    setError(null)

    const { error: resetError } = await getBrowserClient().auth.resetPasswordForEmail(email, {
      redirectTo: callbackUrl('/account/password'),
    })

    setBusy(false)
    if (resetError) return setError(resetError.message)
    setSent('reset')
  }

  if (sent) {
    return (
      <div className="space-y-3 rounded-lg border bg-muted/40 p-4 text-center">
        <Mail className="mx-auto h-6 w-6 text-primary" />
        <p className="text-sm font-medium">Check your inbox</p>
        <p className="text-sm text-muted-foreground">
          {sent === 'link' ? 'We sent a sign-in link to ' : 'We sent a password reset link to '}
          <span className="font-medium">{email}</span>.
        </p>
        <Button variant="ghost" size="sm" onClick={() => setSent(null)}>
          Use a different address
        </Button>
      </div>
    )
  }

  return (
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

      {mode === 'password' ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <button
              type="button"
              onClick={sendReset}
              disabled={busy}
              className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              Forgot password?
            </button>
          </div>
          <Input
            id="password"
            type="password"
            required
            minLength={MIN_PASSWORD_LENGTH}
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </div>
      ) : null}

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <Button type="submit" className="w-full" disabled={busy}>
        {busy ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            {mode === 'password' ? 'Signing in…' : 'Sending…'}
          </>
        ) : mode === 'password' ? (
          'Sign in'
        ) : (
          'Email me a sign-in link'
        )}
      </Button>

      <p className="text-center text-xs text-muted-foreground">
        <button
          type="button"
          onClick={() => {
            setMode(mode === 'password' ? 'link' : 'password')
            setError(null)
          }}
          className="underline-offset-4 hover:text-foreground hover:underline"
        >
          {mode === 'password'
            ? 'Email me a sign-in link instead'
            : 'Sign in with a password instead'}
        </button>
      </p>
    </form>
  )
}
