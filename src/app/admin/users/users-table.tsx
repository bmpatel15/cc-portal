'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { Loader2, UserPlus } from 'lucide-react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { displayName } from '@/lib/profiles/display'
import { USER_ROLES } from '@/lib/schemas/profile'
import type { ProfileRow, UserRole } from '@/lib/supabase/types'

import { inviteStaffAction, updateProfileAction } from './actions'

const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Admin',
  staff: 'Staff',
}

export function UsersTable({
  profiles,
  currentUserId,
}: {
  profiles: ProfileRow[]
  currentUserId: string
}) {
  const router = useRouter()
  // Track the row being saved so only that row's controls freeze.
  const [saving, setSaving] = React.useState<string | null>(null)
  const [pending, startTransition] = React.useTransition()

  const waiting = profiles.filter((profile) => !profile.is_active).length

  function save(profile: ProfileRow, changes: { role?: UserRole; isActive?: boolean }) {
    setSaving(profile.id)

    startTransition(async () => {
      const result = await updateProfileAction({
        profileId: profile.id,
        role: changes.role ?? profile.role,
        isActive: changes.isActive ?? profile.is_active,
      })

      if (result.success) {
        toast.success(result.message)
        router.refresh()
      } else {
        toast.error(result.message)
      }

      setSaving(null)
    })
  }

  return (
    <div className="space-y-5">
      <InviteForm />

      <Card>
        <CardHeader>
          <CardTitle>Team</CardTitle>
          <CardDescription>
            Staff can claim unassigned requests and advance their own; admins can reassign,
            reopen, and cancel anything. Revoke access to suspend someone without deleting their
            history.
            {waiting > 0
              ? ` ${waiting} account${waiting === 1 ? '' : 's'} waiting for approval.`
              : ''}
          </CardDescription>
        </CardHeader>

        <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Person</TableHead>
              <TableHead className="hidden lg:table-cell">Joined</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Access</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {profiles.map((profile) => {
              const isSelf = profile.id === currentUserId
              const busy = pending && saving === profile.id

              return (
                <TableRow key={profile.id}>
                  <TableCell className="max-w-[18rem]">
                    <p className="truncate font-medium">
                      {displayName(profile)}
                      {isSelf ? <span className="text-muted-foreground"> (you)</span> : null}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">{profile.email}</p>
                  </TableCell>

                  <TableCell className="hidden whitespace-nowrap text-muted-foreground lg:table-cell">
                    {format(new Date(profile.created_at), 'd MMM yyyy')}
                  </TableCell>

                  <TableCell>
                    {isSelf ? (
                      <Badge variant="secondary">{ROLE_LABELS[profile.role]}</Badge>
                    ) : (
                      <Select
                        value={profile.role}
                        disabled={busy}
                        onValueChange={(value) => save(profile, { role: value as UserRole })}
                      >
                        <SelectTrigger className="w-[7.5rem]" aria-label="Role">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {USER_ROLES.map((role) => (
                            <SelectItem key={role} value={role}>
                              {ROLE_LABELS[role]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </TableCell>

                  <TableCell>
                    {isSelf ? (
                      <Badge variant="complete">Active</Badge>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Badge variant={profile.is_active ? 'complete' : 'pending'}>
                          {profile.is_active ? 'Active' : 'Pending'}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={busy}
                          onClick={() => save(profile, { isActive: !profile.is_active })}
                        >
                          {busy ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : profile.is_active ? (
                            'Revoke'
                          ) : (
                            'Approve'
                          )}
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
        </CardContent>
      </Card>
    </div>
  )
}

/**
 * There is no self-service sign-up — this is the only way an account comes into
 * existence, which is what keeps strangers out of the dashboard.
 */
function InviteForm() {
  const router = useRouter()
  const [email, setEmail] = React.useState('')
  const [role, setRole] = React.useState<UserRole>('staff')
  const [pending, startTransition] = React.useTransition()

  function submit(event: React.FormEvent) {
    event.preventDefault()

    startTransition(async () => {
      const result = await inviteStaffAction({ email, role })

      if (result.success) {
        toast.success(result.message)
        setEmail('')
        setRole('staff')
        router.refresh()
      } else {
        toast.error(result.message)
      }
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Invite a team member</CardTitle>
        <CardDescription>
          Creates the account and emails them a link to set a password. Nobody can sign up on
          their own, so this is the only way in.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form onSubmit={submit} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-2">
            <Label htmlFor="invite-email">Work email</Label>
            <Input
              id="invite-email"
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="colleague@example.org"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="invite-role">Role</Label>
            <Select value={role} onValueChange={(value) => setRole(value as UserRole)}>
              <SelectTrigger id="invite-role" className="w-full sm:w-[7.5rem]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {USER_ROLES.map((value) => (
                  <SelectItem key={value} value={value}>
                    {ROLE_LABELS[value]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button type="submit" disabled={pending || !email}>
            {pending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Sending…
              </>
            ) : (
              <>
                <UserPlus className="h-4 w-4" />
                Send invite
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
