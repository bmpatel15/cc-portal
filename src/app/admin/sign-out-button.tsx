'use client'

import { useRouter } from 'next/navigation'
import { LogOut } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { getBrowserClient } from '@/lib/supabase/client'

export function SignOutButton() {
  const router = useRouter()

  return (
    <Button
      variant="ghost"
      size="sm"
      className="gap-1.5 text-white/80 hover:bg-white/10 hover:text-white"
      onClick={async () => {
        await getBrowserClient().auth.signOut()
        router.push('/login')
        router.refresh()
      }}
    >
      <LogOut className="h-3.5 w-3.5" />
      <span className="hidden sm:inline">Sign out</span>
    </Button>
  )
}
