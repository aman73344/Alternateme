'use client'

import { useState } from 'react'
import { DashboardSidebar } from '@/components/dashboard/sidebar'
import { Button } from '@/components/ui/button'

export default function SettingsPage() {
  const [email, setEmail] = useState('john@example.com')
  const [displayName, setDisplayName] = useState('John Doe')

  return (
    <div className="flex h-screen bg-background">
      <DashboardSidebar />

      <div className="flex-1 overflow-auto">
        {/* Header */}
        <div className="sticky top-0 z-40 border-b border-border bg-card/50 backdrop-blur-md">
          <div className="px-8 py-6">
            <h1 className="text-3xl font-bold text-foreground">Settings</h1>
            <p className="mt-1 text-muted-foreground">Manage your account and preferences</p>
          </div>
        </div>

        {/* Content */}
        <div className="px-8 py-8 max-w-2xl">
          <div className="space-y-8">
            {/* Account Settings */}
            <div className="rounded-lg border border-border bg-card p-6 space-y-4">
              <h2 className="text-xl font-bold text-foreground">Account Settings</h2>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Display Name</label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg border border-border bg-input text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Email Address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg border border-border bg-input text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="flex gap-2">
                <Button className="bg-gradient-primary hover:opacity-90">Save Changes</Button>
                <Button variant="outline">Cancel</Button>
              </div>
            </div>

            {/* Subscription */}
            <div className="rounded-lg border border-border bg-card p-6 space-y-4">
              <h2 className="text-xl font-bold text-foreground">Subscription</h2>

              <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
                <p className="text-sm text-foreground font-medium mb-2">Current Plan: Free</p>
                <p className="text-sm text-muted-foreground">1 digital twin • 10,000 conversations/month • Email & Chat</p>
              </div>

              <Button className="bg-gradient-primary hover:opacity-90" size="lg">
                Upgrade to Pro
              </Button>

              <div className="space-y-3 text-sm">
                <h3 className="font-medium text-foreground">Pro Plan Includes:</h3>
                <ul className="space-y-2 text-muted-foreground">
                  <li>✓ 5 Digital Twins</li>
                  <li>✓ Unlimited conversations</li>
                  <li>✓ All channels (Chat, Email, Voice, Phone)</li>
                  <li>✓ Advanced Analytics</li>
                  <li>✓ Priority Support</li>
                </ul>
              </div>
            </div>

            {/* API Keys */}
            <div className="rounded-lg border border-border bg-card p-6 space-y-4">
              <h2 className="text-xl font-bold text-foreground">API Keys</h2>

              <div className="space-y-2">
                <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/50">
                  <div>
                    <p className="text-sm font-medium text-foreground">Production API Key</p>
                    <p className="text-xs text-muted-foreground">sk_prod_••••••••••</p>
                  </div>
                  <Button variant="outline" size="sm">Copy</Button>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/50">
                  <div>
                    <p className="text-sm font-medium text-foreground">Development API Key</p>
                    <p className="text-xs text-muted-foreground">sk_dev_••••••••••</p>
                  </div>
                  <Button variant="outline" size="sm">Copy</Button>
                </div>
              </div>

              <Button variant="outline">Generate New Key</Button>
            </div>

            {/* Integrations */}
            <div className="rounded-lg border border-border bg-card p-6 space-y-4">
              <h2 className="text-xl font-bold text-foreground">Integrations</h2>

              <div className="space-y-2">
                {['Slack', 'Zapier', 'Make', 'Discord'].map((service) => (
                  <div key={service} className="flex items-center justify-between p-3 rounded-lg border border-border hover:border-primary/50">
                    <span className="text-sm font-medium text-foreground">{service}</span>
                    <Button variant="outline" size="sm">Connect</Button>
                  </div>
                ))}
              </div>
            </div>

            {/* Danger Zone */}
            <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-6 space-y-4">
              <h2 className="text-xl font-bold text-destructive">Danger Zone</h2>

              <div className="space-y-3">
                <div>
                  <p className="text-sm font-medium text-foreground mb-2">Delete Account</p>
                  <p className="text-xs text-muted-foreground mb-3">This action cannot be undone. All your data will be permanently deleted.</p>
                  <Button variant="destructive">Delete My Account</Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
