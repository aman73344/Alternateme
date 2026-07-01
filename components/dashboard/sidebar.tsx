'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'

export function DashboardSidebar() {
  const pathname = usePathname()

  const menuItems = [
    { href: '/dashboard', label: 'Dashboard', icon: '📊' },
    { href: '/dashboard/twins', label: 'My Twins', icon: '🤖' },
    { href: '/dashboard/chat', label: 'Chat', icon: '💬' },
    { href: '/dashboard/analytics', label: 'Analytics', icon: '📈' },
    { href: '/dashboard/settings', label: 'Settings', icon: '⚙️' },
  ]

  return (
    <div className="w-64 border-r border-border bg-card/50 flex flex-col h-screen sticky top-0">
      {/* Logo */}
      <div className="p-6 border-b border-border">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-primary">
            <span className="text-sm font-bold text-primary-foreground">A</span>
          </div>
          <span className="font-bold text-foreground">Alternate Me</span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-6 space-y-2">
        {menuItems.map((item) => {
          const isActive = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all text-sm font-medium ${
                isActive
                  ? 'bg-primary/10 border border-primary text-primary'
                  : 'text-muted-foreground hover:text-foreground hover:bg-card'
              }`}
            >
              <span>{item.icon}</span>
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-border space-y-3">
        <div className="text-xs text-muted-foreground px-3">
          <p className="font-medium text-foreground mb-1">Free Plan</p>
          <p>1/5 twins created</p>
        </div>
        <Button variant="outline" className="w-full text-sm" asChild>
          <Link href="/dashboard/settings">Upgrade Plan</Link>
        </Button>
      </div>
    </div>
  )
}
