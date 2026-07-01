'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { MessageSquare, Settings, BarChart3, Code2, Copy, ExternalLink } from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts'
import { useState } from 'react'

const chartData = [
  { date: 'Mon', conversations: 120, users: 24 },
  { date: 'Tue', conversations: 150, users: 32 },
  { date: 'Wed', conversations: 200, users: 45 },
  { date: 'Thu', conversations: 180, users: 38 },
  { date: 'Fri', conversations: 220, users: 52 },
  { date: 'Sat', conversations: 190, users: 41 },
  { date: 'Sun', conversations: 160, users: 35 },
]

const transcripts = [
  {
    id: '1',
    user: 'Sarah Johnson',
    message: 'Can I schedule a consultation?',
    response: 'Of course! I have availability next Tuesday at 2 PM or Thursday at 10 AM. Which works better for you?',
    timestamp: '2 hours ago',
    duration: '3m 45s',
  },
  {
    id: '2',
    user: 'Mike Chen',
    message: 'What services do you offer?',
    response: 'I specialize in tech consulting, business strategy, and digital transformation. I&apos;d be happy to discuss your specific needs.',
    timestamp: '4 hours ago',
    duration: '2m 12s',
  },
  {
    id: '3',
    user: 'Emma Davis',
    message: 'How much does it cost?',
    response: 'Pricing depends on the scope of the project. I typically charge on an hourly basis or offer custom packages.',
    timestamp: '6 hours ago',
    duration: '1m 58s',
  },
]

const embedCode = `<iframe 
  src="https://alternate.me/john-doe-expert" 
  width="100%" 
  height="600" 
  frameborder="0"
  allow="microphone"
></iframe>`

export default function AlternateDetailPage({ params }: { params: { id: string } }) {
  const [copied, setCopied] = useState(false)

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="p-8 overflow-auto">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold">John Doe - Expert</h1>
            <p className="text-foreground/60 mt-1">Tech Consultant</p>
            <div className="flex items-center gap-4 mt-4">
              <span className="inline-block px-3 py-1 rounded-full text-sm font-medium bg-green-500/10 text-green-600 border border-green-500/20">
                Active
              </span>
              <a href="https://alternate.me/john-doe-expert" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-primary hover:underline text-sm">
                alternate.me/john-doe-expert
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
          <Button variant="outline">Edit Twin</Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[
            { label: 'Total Conversations', value: '234' },
            { label: 'Active Users', value: '45' },
            { label: 'Avg Response Time', value: '2.1s' },
            { label: 'Satisfaction', value: '96%' },
          ].map((stat) => (
            <Card key={stat.label} className="card-hover">
              <CardContent className="pt-6">
                <p className="text-sm text-foreground/60">{stat.label}</p>
                <p className="text-2xl font-bold mt-2">{stat.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Tabs */}
        <Tabs defaultValue="chat" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="chat" className="gap-2">
              <MessageSquare className="w-4 h-4" />
              <span className="hidden sm:inline">Transcripts</span>
            </TabsTrigger>
            <TabsTrigger value="analytics" className="gap-2">
              <BarChart3 className="w-4 h-4" />
              <span className="hidden sm:inline">Analytics</span>
            </TabsTrigger>
            <TabsTrigger value="customize" className="gap-2">
              <Settings className="w-4 h-4" />
              <span className="hidden sm:inline">Customize</span>
            </TabsTrigger>
            <TabsTrigger value="embed" className="gap-2">
              <Code2 className="w-4 h-4" />
              <span className="hidden sm:inline">Embed</span>
            </TabsTrigger>
          </TabsList>

          {/* Chat Transcripts Tab */}
          <TabsContent value="chat" className="space-y-4">
            <Card className="card-hover">
              <CardHeader>
                <CardTitle>Recent Chat Transcripts</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {transcripts.map((transcript) => (
                  <div key={transcript.id} className="border border-border rounded-lg p-4 hover:bg-secondary/30 transition-colors">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <p className="font-semibold">{transcript.user}</p>
                        <p className="text-xs text-foreground/60">{transcript.timestamp}</p>
                      </div>
                      <span className="text-xs text-foreground/50">{transcript.duration}</span>
                    </div>
                    <div className="space-y-2">
                      <div className="p-3 rounded bg-secondary/50">
                        <p className="text-sm"><strong>User:</strong> {transcript.message}</p>
                      </div>
                      <div className="p-3 rounded bg-primary/10">
                        <p className="text-sm"><strong>Twin:</strong> {transcript.response}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="card-hover">
                <CardHeader>
                  <CardTitle>Conversations Over Time</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="colorConv" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#7c3aed" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#2d2535" />
                      <XAxis dataKey="date" stroke="#a8a8b8" />
                      <YAxis stroke="#a8a8b8" />
                      <Tooltip contentStyle={{ backgroundColor: '#1a1625', border: '1px solid #2d2535', borderRadius: '8px' }} />
                      <Area type="monotone" dataKey="conversations" stroke="#7c3aed" fillOpacity={1} fill="url(#colorConv)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card className="card-hover">
                <CardHeader>
                  <CardTitle>Active Users</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#2d2535" />
                      <XAxis dataKey="date" stroke="#a8a8b8" />
                      <YAxis stroke="#a8a8b8" />
                      <Tooltip contentStyle={{ backgroundColor: '#1a1625', border: '1px solid #2d2535', borderRadius: '8px' }} />
                      <Line type="monotone" dataKey="users" stroke="#6366f1" strokeWidth={2} dot={{ fill: '#6366f1' }} />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Customize Tab */}
          <TabsContent value="customize" className="space-y-4">
            <Card className="card-hover">
              <CardHeader>
                <CardTitle>Customize Your Twin</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3 p-4 rounded-lg bg-secondary/30 border border-border">
                  <p className="font-semibold">Personality Settings</p>
                  <ul className="text-sm text-foreground/70 space-y-2">
                    <li>• Tone: Professional</li>
                    <li>• Personality: Friendly, Detail-oriented</li>
                    <li>• AI Provider: GPT-4</li>
                  </ul>
                </div>
                <Button className="bg-gradient-primary hover:opacity-90">Edit Settings</Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Embed Tab */}
          <TabsContent value="embed" className="space-y-4">
            <Card className="card-hover">
              <CardHeader>
                <CardTitle>Embed Code</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 rounded-lg bg-secondary/50 border border-border">
                  <p className="text-sm text-foreground/60 mb-3">Copy this code to embed your digital twin on your website:</p>
                  <div className="relative">
                    <pre className="p-4 rounded bg-background/50 border border-border overflow-x-auto text-xs text-foreground/70">
                      {embedCode}
                    </pre>
                    <Button
                      size="sm"
                      variant="outline"
                      className="absolute top-2 right-2"
                      onClick={() => copyToClipboard(embedCode)}
                    >
                      {copied ? 'Copied!' : <Copy className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>
                
                <div className="p-4 rounded-lg bg-secondary/30 border border-border">
                  <p className="font-semibold text-sm mb-2">Public URL</p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value="https://alternate.me/john-doe-expert"
                      readOnly
                      className="flex-1 px-3 py-2 rounded bg-background border border-border text-sm text-foreground/70"
                    />
                    <Button size="sm" variant="outline" onClick={() => copyToClipboard('https://alternate.me/john-doe-expert')}>
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
