import Link from 'next/link'

import { ThemeToggle } from '@/components/theme-toggle'

export function SiteHeader({
  title = 'Content Request Portal',
  subtitle,
  action,
}: {
  title?: string
  subtitle?: string
  action?: React.ReactNode
}) {
  return (
    <header className="bg-[#1C2127]">
      <div className="container mx-auto flex items-center justify-between gap-4 px-4 py-5 sm:px-6 lg:px-8">
        <div className="min-w-0">
          <Link href="/" className="block">
            <h1 className="truncate text-lg font-semibold tracking-tight text-white sm:text-xl">
              {title}
            </h1>
          </Link>
          {subtitle ? (
            <p className="mt-0.5 truncate text-xs text-white/60 sm:text-sm">{subtitle}</p>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {action}
          <ThemeToggle />
        </div>
      </div>
    </header>
  )
}
