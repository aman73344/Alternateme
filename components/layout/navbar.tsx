'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'

interface NavbarProps {
  showCTA?: boolean
}

export function Navbar({ showCTA = true }: NavbarProps) {
  return (
    <nav className="fixed top-0 z-50 w-full border-b border-border bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-primary">
            <span className="text-sm font-bold text-primary-foreground">A</span>
          </div>
          <span className="hidden font-bold text-foreground sm:inline">Alternate Me</span>
        </Link>

        <div className="hidden items-center gap-8 md:flex">
          <Link href="/#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            Features
          </Link>
          <Link href="/#how-it-works" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            How It Works
          </Link>
          <Link href="/#pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            Pricing
          </Link>
        </div>

        {showCTA && (
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/sign-in">Sign In</Link>
            </Button>
            <Button size="sm" asChild className="bg-gradient-primary hover:opacity-90">
              <Link href="/sign-up">Get Started</Link>
            </Button>
          </div>
        )}
      </div>
    </nav>
  )
}
