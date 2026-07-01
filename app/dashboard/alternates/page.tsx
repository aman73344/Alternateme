'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Search, Plus, MoreVertical, Edit, Trash2, Copy } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'

const alternates = [
  {
    id: '1',
    name: 'John Doe - Expert',
    title: 'Tech Consultant',
    status: 'active',
    conversations: 234,
    users: 45,
    created: '2024-01-15',
    url: 'alternate.me/john-doe-expert',
  },
  {
    id: '2',
    name: 'Jane Smith - Coach',
    title: 'Business Coach',
    status: 'active',
    conversations: 189,
    users: 32,
    created: '2024-02-03',
    url: 'alternate.me/jane-smith-coach',
  },
  {
    id: '3',
    name: 'Alex Johnson - Support',
    title: 'Customer Support',
    status: 'idle',
    conversations: 412,
    users: 78,
    created: '2024-01-20',
    url: 'alternate.me/alex-johnson-support',
  },
  {
    id: '4',
    name: 'Maria Garcia - Sales',
    title: 'Sales Representative',
    status: 'training',
    conversations: 0,
    users: 0,
    created: '2024-06-18',
    url: 'alternate.me/maria-garcia-sales',
  },
]

export default function AlternatesPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  const filtered = alternates.filter((alt) => {
    const matchesSearch = alt.name.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesStatus = statusFilter === 'all' || alt.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-500/10 text-green-600 border border-green-500/20'
      case 'idle':
        return 'bg-yellow-500/10 text-yellow-600 border border-yellow-500/20'
      case 'training':
        return 'bg-blue-500/10 text-blue-600 border border-blue-500/20'
      default:
        return 'bg-gray-500/10 text-gray-600 border border-gray-500/20'
    }
  }

  return (
    <div className="p-8 overflow-auto">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Your Digital Twins</h1>
            <p className="text-foreground/60 mt-1">Manage all your digital twins in one place</p>
          </div>
          <Link href="/onboarding">
            <Button className="bg-gradient-primary hover:opacity-90 gap-2">
              <Plus className="w-4 h-4" />
              Create New Twin
            </Button>
          </Link>
        </div>

        {/* Filters */}
        <Card className="card-hover">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search twins..."
                  className="pl-10"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <div className="flex gap-2">
                {['all', 'active', 'idle', 'training'].map((status) => (
                  <Button
                    key={status}
                    variant={statusFilter === status ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setStatusFilter(status)}
                    className={statusFilter === status ? 'bg-gradient-primary' : ''}
                  >
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                  </Button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Alternates Table */}
        <Card className="card-hover overflow-hidden">
          <CardHeader>
            <CardTitle>All Digital Twins ({filtered.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-4 font-semibold text-foreground/70 text-sm">Name</th>
                    <th className="text-left py-3 px-4 font-semibold text-foreground/70 text-sm">Status</th>
                    <th className="text-left py-3 px-4 font-semibold text-foreground/70 text-sm">Conversations</th>
                    <th className="text-left py-3 px-4 font-semibold text-foreground/70 text-sm">Users</th>
                    <th className="text-left py-3 px-4 font-semibold text-foreground/70 text-sm">Created</th>
                    <th className="text-left py-3 px-4 font-semibold text-foreground/70 text-sm">URL</th>
                    <th className="text-left py-3 px-4 font-semibold text-foreground/70 text-sm">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((alt) => (
                    <tr key={alt.id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                      <td className="py-4 px-4">
                        <Link href={`/dashboard/alternates/${alt.id}`} className="font-semibold hover:text-primary transition-colors">
                          {alt.name}
                        </Link>
                        <p className="text-xs text-foreground/60">{alt.title}</p>
                      </td>
                      <td className="py-4 px-4">
                        <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium capitalize ${getStatusColor(alt.status)}`}>
                          {alt.status}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-sm">{alt.conversations}</td>
                      <td className="py-4 px-4 text-sm">{alt.users}</td>
                      <td className="py-4 px-4 text-sm text-foreground/60">{alt.created}</td>
                      <td className="py-4 px-4 text-sm">
                        <code className="bg-secondary px-2 py-1 rounded text-xs font-mono text-foreground/70">
                          {alt.url.split('/')[1]}
                        </code>
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex gap-2">
                          <Button variant="ghost" size="sm" title="Edit">
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="sm" title="Copy URL">
                            <Copy className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="sm" title="Delete" className="hover:text-destructive">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
