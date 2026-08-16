import Link from 'next/link'
import { LogIn } from 'lucide-react'

import { Button } from '@/components/ui/button'

/**
 * Header sign-in link for the public pages.
 *
 * Styled for the dark header bar rather than the page surface, which is why it
 * carries its own colours instead of using a button variant.
 */
export function HeaderSignInButton() {
  return (
    <Button
      asChild
      variant="ghost"
      size="sm"
      className="text-white/80 hover:bg-white/10 hover:text-white"
    >
      <Link href="/login">
        <LogIn className="h-4 w-4" />
        <span className="hidden sm:inline">Team sign in</span>
      </Link>
    </Button>
  )
}
