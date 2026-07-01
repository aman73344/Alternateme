'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  Zap,
  Settings,
  HelpCircle,
  LogOut,
  MessageSquare,
  BarChart3,
  Code2,
  User,
} from 'lucide-react'
import { Button } from '@/components/ui/button'

export function DashboardSidebar() {
  const pathname = usePathname()

  const menuItems = [
    { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { label: 'My Alternates', href: '/dashboard/alternates', icon: User },
    { label: 'Chat Transcripts', href: '/dashboard/transcripts', icon: MessageSquare },
    { label: 'Analytics', href: '/dashboard/analytics', icon: BarChart3 },
    { label: 'Embed Code', href: '/dashboard/embed', icon: Code2 },
  ]

  const bottomItems = [
    { label: 'Settings', href: '/dashboard/settings', icon: Settings },
    { label: 'Help & Support', href: '/dashboard/help', icon: HelpCircle },
  ]

  return (
    <aside className="w-64 bg-sidebar border-r border-sidebar-border h-screen flex flex-col">
      {/* Logo */}
      <div className="p-6 border-b border-sidebar-border">
        <Link href="/dashboard" className="flex items-center gap-2 font-bold">
          <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <span className="text-sidebar-foreground">Alternate Me</span>
        </Link>
      </div>

      {/* Main Menu */}
      <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
        {menuItems.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href
          return (
            <Link key={item.href} href={item.href}>
              <div
                className={cn(
                  'flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200',
                  isActive
                    ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                    : 'text-sidebar-foreground hover:bg-sidebar-accent/50'
                )}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                <span className="text-sm font-medium">{item.label}</span>
              </div>
            </Link>
          )
        })}
      </nav>

      {/* Bottom Menu */}
      <div className="border-t border-sidebar-border p-4 space-y-2">
        {bottomItems.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href
          return (
            <Link key={item.href} href={item.href}>
              <div
                className={cn(
                  'flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200',
                  isActive
                    ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                    : 'text-sidebar-foreground hover:bg-sidebar-accent/50'
                )}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                <span className="text-sm font-medium">{item.label}</span>
              </div>
            </Link>
          )
        })}
        
        <Button variant="ghost" className="w-full justify-start text-foreground/70 hover:text-foreground" size="sm">
          <LogOut className="w-5 h-5 mr-3" />
          Sign Out
        </Button>
      </div>
    </aside>
  )
}
