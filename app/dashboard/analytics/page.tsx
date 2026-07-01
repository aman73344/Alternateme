'use client'

import { DashboardSidebar } from '@/components/dashboard/sidebar'

export default function AnalyticsPage() {
  const stats = [
    { label: 'Total Conversations', value: '1,247', change: '+12%' },
    { label: 'Avg Response Time', value: '2.1s', change: '-0.3s' },
    { label: 'User Satisfaction', value: '4.8★', change: '+0.2' },
    { label: 'Resolution Rate', value: '92%', change: '+5%' },
  ]

  return (
    <div className="flex h-screen bg-background">
      <DashboardSidebar />

      <div className="flex-1 overflow-auto">
        {/* Header */}
        <div className="sticky top-0 z-40 border-b border-border bg-card/50 backdrop-blur-md">
          <div className="px-8 py-6">
            <h1 className="text-3xl font-bold text-foreground">Analytics</h1>
            <p className="mt-1 text-muted-foreground">Track your twins performance</p>
          </div>
        </div>

        {/* Content */}
        <div className="px-8 py-8 space-y-8">
          {/* Stats Grid */}
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {stats.map((stat, i) => (
              <div key={i} className="rounded-lg border border-border bg-card p-6">
                <p className="text-sm text-muted-foreground font-medium">{stat.label}</p>
                <p className="mt-2 text-3xl font-bold text-foreground">{stat.value}</p>
                <p className="mt-2 text-xs text-primary">{stat.change} from last month</p>
              </div>
            ))}
          </div>

          {/* Charts */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Conversation Trend */}
            <div className="rounded-lg border border-border bg-card p-6">
              <h3 className="font-bold text-foreground mb-4">Conversation Trend</h3>
              <div className="h-40 flex items-end justify-between gap-2">
                {[20, 35, 28, 42, 38, 50, 45, 55, 48, 60, 52, 58].map((height, i) => (
                  <div
                    key={i}
                    className="flex-1 rounded-t bg-gradient-primary"
                    style={{ height: `${(height / 70) * 100}%` }}
                  ></div>
                ))}
              </div>
              <p className="mt-4 text-xs text-muted-foreground text-center">Last 12 weeks</p>
            </div>

            {/* Channel Distribution */}
            <div className="rounded-lg border border-border bg-card p-6">
              <h3 className="font-bold text-foreground mb-4">Channel Distribution</h3>
              <div className="space-y-4">
                {[
                  { name: 'Chat', value: 45, color: 'bg-blue-500' },
                  { name: 'Email', value: 30, color: 'bg-purple-500' },
                  { name: 'Voice', value: 15, color: 'bg-green-500' },
                  { name: 'Phone', value: 10, color: 'bg-amber-500' },
                ].map((channel) => (
                  <div key={channel.name}>
                    <div className="flex justify-between mb-2 text-sm">
                      <span className="text-foreground font-medium">{channel.name}</span>
                      <span className="text-muted-foreground">{channel.value}%</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full ${channel.color}`}
                        style={{ width: `${channel.value}%` }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Response Time Distribution */}
            <div className="rounded-lg border border-border bg-card p-6">
              <h3 className="font-bold text-foreground mb-4">Response Time Distribution</h3>
              <div className="h-40 flex items-end justify-between gap-1">
                {[5, 12, 28, 35, 15, 4, 1].map((height, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center">
                    <div
                      className="w-full rounded-t bg-gradient-accent"
                      style={{ height: `${(height / 40) * 100}%` }}
                    ></div>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex justify-between text-xs text-muted-foreground">
                <span>&lt;1s</span>
                <span>1-2s</span>
                <span>2-3s</span>
                <span>3-5s</span>
                <span>5-10s</span>
                <span>10-30s</span>
                <span>&gt;30s</span>
              </div>
            </div>

            {/* Top Performing Twins */}
            <div className="rounded-lg border border-border bg-card p-6">
              <h3 className="font-bold text-foreground mb-4">Top Performing Twins</h3>
              <div className="space-y-3">
                {[
                  { name: 'John Doe - Main', conversations: 847, satisfaction: '4.9' },
                  { name: 'John Doe - Sales', conversations: 312, satisfaction: '4.7' },
                  { name: 'John Doe - Support', conversations: 88, satisfaction: '4.6' },
                ].map((twin, i) => (
                  <div key={i} className="flex items-center justify-between text-sm p-2 rounded hover:bg-muted/50">
                    <span className="text-foreground">{twin.name}</span>
                    <div className="flex gap-4 text-muted-foreground">
                      <span>{twin.conversations} convs</span>
                      <span className="text-primary">{twin.satisfaction}★</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
