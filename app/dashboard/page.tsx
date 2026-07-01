'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { MessageSquare, Users, TrendingUp, Zap, Plus } from 'lucide-react'

export default function DashboardPage() {
  const stats = [
    {
      title: 'Total Conversations',
      value: '2,543',
      description: 'In the last 30 days',
      icon: MessageSquare,
      color: 'bg-purple-500/10',
      iconColor: 'text-purple-500',
    },
    {
      title: 'Active Users',
      value: '156',
      description: 'Interacting with your twins',
      icon: Users,
      color: 'bg-indigo-500/10',
      iconColor: 'text-indigo-500',
    },
    {
      title: 'Satisfaction Rate',
      value: '94%',
      description: 'Average user satisfaction',
      icon: TrendingUp,
      color: 'bg-blue-500/10',
      iconColor: 'text-blue-500',
    },
    {
      title: 'API Calls',
      value: '15.2k',
      description: 'This month',
      icon: Zap,
      color: 'bg-cyan-500/10',
      iconColor: 'text-cyan-500',
    },
  ]

  const recentAlternates = [
    {
      id: '1',
      name: 'John Doe - Expert',
      description: 'Tech Consultant',
      status: 'active',
      conversations: '234',
      lastActive: '2 minutes ago',
    },
    {
      id: '2',
      name: 'Jane Smith - Coach',
      description: 'Business Coach',
      status: 'active',
      conversations: '189',
      lastActive: '15 minutes ago',
    },
    {
      id: '3',
      name: 'Alex Johnson - Support',
      description: 'Customer Support',
      status: 'idle',
      conversations: '412',
      lastActive: '2 hours ago',
    },
  ]

  return (
    <div className="p-8 overflow-auto">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Dashboard</h1>
            <p className="text-foreground/60 mt-1">Welcome back! Here&apos;s your overview.</p>
          </div>
          <Link href="/onboarding">
            <Button className="bg-gradient-primary hover:opacity-90 gap-2">
              <Plus className="w-4 h-4" />
              Create New Twin
            </Button>
          </Link>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((stat) => {
            const Icon = stat.icon
            return (
              <Card key={stat.title} className="card-hover">
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="text-sm text-foreground/60">{stat.title}</p>
                      <p className="text-3xl font-bold mt-2">{stat.value}</p>
                      <p className="text-xs text-foreground/50 mt-2">{stat.description}</p>
                    </div>
                    <div className={`w-12 h-12 rounded-lg ${stat.color} flex items-center justify-center`}>
                      <Icon className={`w-6 h-6 ${stat.iconColor}`} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>

        {/* Recent Alternates */}
        <Card className="card-hover">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Your Digital Twins</CardTitle>
              <Link href="/dashboard/alternates">
                <Button variant="ghost" size="sm">View All</Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentAlternates.map((alt) => (
                <Link key={alt.id} href={`/dashboard/alternates/${alt.id}`}>
                  <div className="flex items-center justify-between p-4 rounded-lg border border-border hover:bg-secondary/50 transition-colors">
                    <div className="flex-1">
                      <p className="font-semibold">{alt.name}</p>
                      <p className="text-sm text-foreground/60">{alt.description}</p>
                    </div>
                    <div className="flex items-center gap-8">
                      <div className="text-right">
                        <p className="text-sm text-foreground/60">{alt.conversations} conversations</p>
                        <p className="text-xs text-foreground/50">{alt.lastActive}</p>
                      </div>
                      <div className={`w-2 h-2 rounded-full ${alt.status === 'active' ? 'bg-green-500' : 'bg-yellow-500'}`} />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card className="card-hover bg-gradient-to-r from-purple-600/10 to-indigo-600/10 border border-purple-500/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-lg">Upgrade to Professional</h3>
                <p className="text-foreground/60 text-sm mt-1">Unlock unlimited twins, voice channels, and advanced analytics.</p>
              </div>
              <Button className="bg-gradient-primary hover:opacity-90">Upgrade Now</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
