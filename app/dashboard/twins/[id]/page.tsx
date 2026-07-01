'use client'

import { useState } from 'react'
import Link from 'next/link'
import { DashboardSidebar } from '@/components/dashboard/sidebar'
import { Button } from '@/components/ui/button'

type Tab = 'overview' | 'transcripts' | 'customize' | 'analytics' | 'embed'

export default function TwinDetailPage({ params }: { params: { id: string } }) {
  const [activeTab, setActiveTab] = useState<Tab>('overview')
  const [copied, setCopied] = useState(false)

  const twin = {
    id: params.id,
    name: 'John Doe - Main',
    status: 'active',
    conversations: 847,
    responseRate: '98.5%',
    created: '2 weeks ago',
    publicUrl: 'https://alternate.me/john-doe-main',
    embedCode: `<iframe src="https://alternate.me/embed/john-doe-main" width="400" height="500"></iframe>`,
  }

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'transcripts', label: 'Chat Transcripts' },
    { id: 'customize', label: 'Customize' },
    { id: 'analytics', label: 'Analytics' },
    { id: 'embed', label: 'Embed Code' },
  ] as const

  const handleCopyEmbed = () => {
    navigator.clipboard.writeText(twin.embedCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const chatTranscripts = [
    {
      id: 1,
      user: 'Sarah Johnson',
      date: '2 hours ago',
      messages: 5,
      preview: 'Can I schedule a consultation?',
    },
    {
      id: 2,
      user: 'Mike Chen',
      date: '5 hours ago',
      messages: 8,
      preview: 'What services do you offer?',
    },
    {
      id: 3,
      user: 'Emma Davis',
      date: '1 day ago',
      messages: 12,
      preview: 'Tell me more about your pricing',
    },
  ]

  return (
    <div className="flex h-screen bg-background">
      <DashboardSidebar />

      <div className="flex-1 overflow-auto">
        {/* Header */}
        <div className="sticky top-0 z-40 border-b border-border bg-card/50 backdrop-blur-md">
          <div className="px-8 py-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-4">
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/dashboard/twins">← Back to Twins</Link>
                </Button>
                <div>
                  <h1 className="text-2xl font-bold text-foreground">{twin.name}</h1>
                  <p className="text-sm text-muted-foreground">Created {twin.created}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 text-sm font-medium text-green-400">
                  <span className="h-2 w-2 rounded-full bg-green-400"></span>
                  Active
                </span>
              </div>
            </div>

            {/* Tab Navigation */}
            <div className="flex gap-2 border-b border-border/50 pb-0">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === tab.id
                      ? 'border-primary text-primary'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="px-8 py-8">
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div className="grid gap-4 md:grid-cols-4">
                <div className="rounded-lg border border-border bg-card p-4">
                  <p className="text-sm text-muted-foreground">Total Conversations</p>
                  <p className="mt-2 text-3xl font-bold text-foreground">{twin.conversations}</p>
                  <p className="mt-1 text-xs text-green-400">+47 this week</p>
                </div>
                <div className="rounded-lg border border-border bg-card p-4">
                  <p className="text-sm text-muted-foreground">Response Rate</p>
                  <p className="mt-2 text-3xl font-bold text-foreground">{twin.responseRate}</p>
                  <p className="mt-1 text-xs text-green-400">+2.1% from last week</p>
                </div>
                <div className="rounded-lg border border-border bg-card p-4">
                  <p className="text-sm text-muted-foreground">Avg Response Time</p>
                  <p className="mt-2 text-3xl font-bold text-foreground">2.1s</p>
                  <p className="mt-1 text-xs text-green-400">-0.3s from last week</p>
                </div>
                <div className="rounded-lg border border-border bg-card p-4">
                  <p className="text-sm text-muted-foreground">User Satisfaction</p>
                  <p className="mt-2 text-3xl font-bold text-foreground">4.8★</p>
                  <p className="mt-1 text-xs text-green-400">from 340 ratings</p>
                </div>
              </div>

              <div className="rounded-lg border border-border bg-card p-6">
                <h3 className="font-bold text-foreground mb-4">Configuration</h3>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Channels</p>
                    <div className="flex flex-wrap gap-2">
                      {['Chat', 'Email', 'Voice', 'Phone'].map((ch) => (
                        <span key={ch} className="inline-block px-3 py-1 rounded-full text-xs bg-primary/10 text-primary">
                          {ch}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">AI Provider</p>
                    <p className="text-sm font-medium text-foreground">OpenAI GPT-4</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Voice</p>
                    <p className="text-sm font-medium text-foreground">Cloned (American accent)</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Status</p>
                    <p className="text-sm font-medium text-green-400">Active</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Chat Transcripts Tab */}
          {activeTab === 'transcripts' && (
            <div className="space-y-4">
              {chatTranscripts.map((transcript) => (
                <div key={transcript.id} className="rounded-lg border border-border bg-card p-4 cursor-pointer hover:border-primary/50 transition-colors">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="font-medium text-foreground">{transcript.user}</p>
                      <p className="text-xs text-muted-foreground mt-1">{transcript.date}</p>
                    </div>
                    <p className="text-xs text-muted-foreground">{transcript.messages} messages</p>
                  </div>
                  <p className="text-sm text-muted-foreground">{transcript.preview}</p>
                </div>
              ))}
            </div>
          )}

          {/* Customize Tab */}
          {activeTab === 'customize' && (
            <div className="max-w-2xl space-y-6">
              <div className="rounded-lg border border-border bg-card p-6 space-y-4">
                <h3 className="font-bold text-foreground">Persona Traits</h3>
                <div className="space-y-3">
                  <div>
                    <label className="text-sm text-muted-foreground">Communication Tone</label>
                    <select className="mt-2 w-full px-3 py-2 rounded-lg border border-border bg-input text-foreground focus:outline-none focus:ring-2 focus:ring-primary">
                      <option>Professional</option>
                      <option>Casual</option>
                      <option>Technical</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">Personality</label>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {['Friendly', 'Analytical', 'Creative', 'Empathetic'].map((trait) => (
                        <button
                          key={trait}
                          className="px-3 py-1 rounded-full text-xs border border-primary bg-primary/10 text-primary"
                        >
                          {trait} ✓
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <Button className="bg-gradient-primary hover:opacity-90">Save Changes</Button>
                <Button variant="outline">Discard</Button>
              </div>
            </div>
          )}

          {/* Analytics Tab */}
          {activeTab === 'analytics' && (
            <div className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-lg border border-border bg-card p-6">
                  <h3 className="font-bold text-foreground mb-4">Conversation Volume</h3>
                  <div className="h-40 flex items-end justify-between gap-2">
                    {[30, 45, 35, 50, 40, 55, 48].map((height, i) => (
                      <div
                        key={i}
                        className="flex-1 rounded-t bg-gradient-primary"
                        style={{ height: `${(height / 60) * 100}%` }}
                      ></div>
                    ))}
                  </div>
                  <p className="mt-4 text-xs text-muted-foreground text-center">Last 7 days</p>
                </div>

                <div className="rounded-lg border border-border bg-card p-6">
                  <h3 className="font-bold text-foreground mb-4">Channel Usage</h3>
                  <div className="space-y-3">
                    {[
                      { name: 'Chat', value: 45, color: 'bg-blue-500' },
                      { name: 'Email', value: 35, color: 'bg-purple-500' },
                      { name: 'Voice', value: 15, color: 'bg-green-500' },
                      { name: 'Phone', value: 5, color: 'bg-amber-500' },
                    ].map((channel) => (
                      <div key={channel.name}>
                        <div className="flex justify-between mb-1 text-xs">
                          <span className="text-foreground">{channel.name}</span>
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
              </div>
            </div>
          )}

          {/* Embed Code Tab */}
          {activeTab === 'embed' && (
            <div className="max-w-2xl space-y-6">
              <div className="rounded-lg border border-border bg-card p-6 space-y-4">
                <div>
                  <h3 className="font-bold text-foreground mb-2">Public URL</h3>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={twin.publicUrl}
                      readOnly
                      className="flex-1 px-4 py-2 rounded-lg border border-border bg-muted text-foreground"
                    />
                    <Button
                      variant="outline"
                      onClick={() => navigator.clipboard.writeText(twin.publicUrl)}
                    >
                      Copy
                    </Button>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">Share this URL to let people chat with your twin</p>
                </div>

                <div>
                  <h3 className="font-bold text-foreground mb-2">Embed Code</h3>
                  <div className="bg-muted p-4 rounded-lg border border-border overflow-auto mb-2">
                    <code className="text-xs text-muted-foreground font-mono">{twin.embedCode}</code>
                  </div>
                  <Button
                    onClick={handleCopyEmbed}
                    className={`${copied ? 'bg-green-500' : 'bg-gradient-primary'} hover:opacity-90`}
                  >
                    {copied ? '✓ Copied' : 'Copy Embed Code'}
                  </Button>
                  <p className="mt-2 text-xs text-muted-foreground">Paste this code into your website to add your twin</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
