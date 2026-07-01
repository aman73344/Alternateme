'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Search, Filter, Download } from 'lucide-react'
import { useState } from 'react'

const conversations = [
  {
    id: '1',
    user: 'Sarah Johnson',
    twin: 'John Doe - Expert',
    subject: 'Scheduling consultation',
    messages: 5,
    duration: '5m 32s',
    timestamp: '2 hours ago',
    sentiment: 'positive',
  },
  {
    id: '2',
    user: 'Mike Chen',
    twin: 'John Doe - Expert',
    subject: 'Service inquiry',
    messages: 8,
    duration: '8m 15s',
    timestamp: '4 hours ago',
    sentiment: 'positive',
  },
  {
    id: '3',
    user: 'Emma Davis',
    twin: 'Jane Smith - Coach',
    subject: 'Pricing discussion',
    messages: 6,
    duration: '6m 48s',
    timestamp: '6 hours ago',
    sentiment: 'neutral',
  },
  {
    id: '4',
    user: 'Alex Miller',
    twin: 'Alex Johnson - Support',
    subject: 'Technical support',
    messages: 12,
    duration: '12m 20s',
    timestamp: '1 day ago',
    sentiment: 'positive',
  },
]

export default function TranscriptsPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null)

  const filtered = conversations.filter((conv) =>
    conv.user.toLowerCase().includes(searchQuery.toLowerCase()) ||
    conv.subject.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const selected = filtered.find((c) => c.id === selectedConversation)

  return (
    <div className="p-8 overflow-auto">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold">Chat Transcripts</h1>
          <p className="text-foreground/60 mt-1">View and manage all conversations</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* List */}
          <div className="lg:col-span-1">
            <Card className="card-hover h-full flex flex-col">
              <CardHeader>
                <CardTitle className="text-lg">Conversations</CardTitle>
              </CardHeader>
              <CardContent className="flex-1 space-y-3 flex flex-col">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search..."
                    className="pl-10"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <div className="flex-1 overflow-y-auto space-y-2">
                  {filtered.map((conv) => (
                    <button
                      key={conv.id}
                      onClick={() => setSelectedConversation(conv.id)}
                      className={`w-full text-left p-3 rounded-lg transition-all border ${
                        selectedConversation === conv.id
                          ? 'bg-primary/10 border-primary'
                          : 'border-border hover:bg-secondary/50'
                      }`}
                    >
                      <p className="font-medium text-sm truncate">{conv.user}</p>
                      <p className="text-xs text-foreground/60 truncate">{conv.subject}</p>
                      <p className="text-xs text-foreground/50 mt-1">{conv.timestamp}</p>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Detail */}
          <div className="lg:col-span-2">
            {selected ? (
              <Card className="card-hover h-full flex flex-col">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle>{selected.user}</CardTitle>
                      <p className="text-sm text-foreground/60 mt-1">{selected.subject}</p>
                    </div>
                    <Button variant="outline" size="sm" className="gap-2">
                      <Download className="w-4 h-4" />
                      Export
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col space-y-4">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="p-3 rounded bg-secondary/50">
                      <p className="text-xs text-foreground/60">Duration</p>
                      <p className="font-semibold">{selected.duration}</p>
                    </div>
                    <div className="p-3 rounded bg-secondary/50">
                      <p className="text-xs text-foreground/60">Messages</p>
                      <p className="font-semibold">{selected.messages}</p>
                    </div>
                    <div className="p-3 rounded bg-secondary/50">
                      <p className="text-xs text-foreground/60">Sentiment</p>
                      <p className="font-semibold capitalize text-green-500">{selected.sentiment}</p>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto space-y-3 p-4 rounded-lg bg-secondary/20 border border-border">
                    <div className="space-y-2">
                      <p className="text-xs text-foreground/50">User Message</p>
                      <div className="p-3 rounded bg-background/50 rounded-lg">
                        <p className="text-sm">Can I schedule a consultation with you next week?</p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <p className="text-xs text-foreground/50">Twin Response</p>
                      <div className="p-3 rounded bg-primary/10 rounded-lg">
                        <p className="text-sm">Of course! I&apos;d be happy to schedule. I have availability Tuesday at 2 PM or Thursday at 10 AM. Which works better for you?</p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <p className="text-xs text-foreground/50">User Message</p>
                      <div className="p-3 rounded bg-background/50 rounded-lg">
                        <p className="text-sm">Tuesday at 2 PM sounds perfect!</p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <p className="text-xs text-foreground/50">Twin Response</p>
                      <div className="p-3 rounded bg-primary/10 rounded-lg">
                        <p className="text-sm">Great! I&apos;ve added you to my calendar. A confirmation email has been sent to you. Looking forward to speaking with you!</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="card-hover h-full flex items-center justify-center">
                <CardContent className="text-center py-12">
                  <p className="text-foreground/60">Select a conversation to view details</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
