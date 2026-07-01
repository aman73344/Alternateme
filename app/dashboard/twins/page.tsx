'use client'

import Link from 'next/link'
import { useState } from 'react'
import { DashboardSidebar } from '@/components/dashboard/sidebar'
import { Button } from '@/components/ui/button'

export default function TwinsPage() {
  const [selectedTwin, setSelectedTwin] = useState<number | null>(null)

  const twins = [
    {
      id: 1,
      name: 'John Doe - Main',
      status: 'active',
      conversations: 847,
      channels: ['Chat', 'Email', 'Voice'],
      created: '2 weeks ago',
      lastModified: '1 hour ago',
      performance: '98.5%',
    },
    {
      id: 2,
      name: 'John Doe - Sales',
      status: 'active',
      conversations: 312,
      channels: ['Chat', 'Phone'],
      created: '1 week ago',
      lastModified: '30 minutes ago',
      performance: '96.2%',
    },
    {
      id: 3,
      name: 'John Doe - Support',
      status: 'training',
      conversations: 88,
      channels: ['Chat', 'Email'],
      created: '3 days ago',
      lastModified: 'In progress',
      performance: '-',
    },
  ]

  return (
    <div className="flex h-screen bg-background">
      <DashboardSidebar />

      <div className="flex-1 overflow-auto">
        {/* Header */}
        <div className="sticky top-0 z-40 border-b border-border bg-card/50 backdrop-blur-md">
          <div className="px-8 py-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-foreground">Digital Twins</h1>
                <p className="mt-1 text-muted-foreground">Manage all your AI twins</p>
              </div>
              <Button className="bg-gradient-primary hover:opacity-90" asChild>
                <Link href="/onboarding">Create New Twin</Link>
              </Button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="px-8 py-8">
          <div className="grid gap-6">
            {twins.map((twin) => (
              <div
                key={twin.id}
                onClick={() => setSelectedTwin(twin.id)}
                className={`rounded-lg border p-6 cursor-pointer transition-all ${
                  selectedTwin === twin.id
                    ? 'border-primary bg-primary/5'
                    : 'border-border bg-card hover:border-primary/50'
                }`}
              >
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-6">
                  {/* Twin Info */}
                  <div className="lg:col-span-2">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-primary">
                        <span className="text-xs font-bold text-primary-foreground">
                          {twin.name.substring(0, 2)}
                        </span>
                      </div>
                      <div>
                        <h3 className="font-semibold text-foreground">{twin.name}</h3>
                        <p className="text-xs text-muted-foreground">Created {twin.created}</p>
                      </div>
                    </div>
                    <div className="mt-3">
                      {twin.status === 'training' ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-400">
                          <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse"></span>
                          Training
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-green-400">
                          <span className="h-2 w-2 rounded-full bg-green-400"></span>
                          Active
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Stats */}
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Conversations</p>
                    <p className="text-2xl font-bold text-foreground">{twin.conversations}</p>
                  </div>

                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Performance</p>
                    <p className="text-2xl font-bold text-foreground">{twin.performance}</p>
                  </div>

                  {/* Channels */}
                  <div>
                    <p className="text-xs text-muted-foreground mb-2">Channels</p>
                    <div className="flex flex-wrap gap-1">
                      {twin.channels.map((channel) => (
                        <span
                          key={channel}
                          className="inline-block text-xs px-2 py-1 rounded-full bg-primary/10 text-primary"
                        >
                          {channel}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-end gap-2">
                    <Button
                      size="sm"
                      className="bg-gradient-primary hover:opacity-90 flex-1"
                      asChild
                    >
                      <Link href={`/dashboard/twins/${twin.id}`}>Manage</Link>
                    </Button>
                  </div>
                </div>

                {/* Expanded Details */}
                {selectedTwin === twin.id && (
                  <div className="mt-6 pt-6 border-t border-border/50 space-y-4">
                    <div className="grid gap-4 md:grid-cols-3">
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Last Modified</p>
                        <p className="text-sm font-medium text-foreground">{twin.lastModified}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Public URL</p>
                        <p className="text-sm font-medium text-primary break-all">alternate.me/{twin.name.replace(/\s+/g, '-').toLowerCase()}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Embeddings</p>
                        <p className="text-sm font-medium text-foreground">2 active</p>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/dashboard/twins/${twin.id}`}>Edit Configuration</Link>
                      </Button>
                      <Button variant="outline" size="sm">Copy Embed Code</Button>
                      <Button variant="outline" size="sm">View Analytics</Button>
                      <Button variant="outline" size="sm">Chat</Button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
