'use client'

import { Card, CardContent } from '@/components/ui/card'
import { MessageSquare, Phone, Mail, Globe, Zap, Brain } from 'lucide-react'

const features = [
  {
    icon: MessageSquare,
    title: 'Chat Interface',
    description: 'Embed AI conversations directly on your website or use standalone chat widget.'
  },
  {
    icon: Mail,
    title: 'Email Responses',
    description: 'Your AI twin automatically responds to emails using your voice and style.'
  },
  {
    icon: Phone,
    title: 'Voice & Phone',
    description: 'Handle phone calls and voice conversations naturally with AI-powered responses.'
  },
  {
    icon: Globe,
    title: 'Multi-Channel',
    description: 'Deploy across web, mobile, WhatsApp, Slack, and other platforms.'
  },
  {
    icon: Brain,
    title: 'Context Learning',
    description: 'Your twin learns from your documents, website, and custom knowledge sources.'
  },
  {
    icon: Zap,
    title: '24/7 Availability',
    description: 'Always-on AI presence that never sleeps, providing instant responses 24/7.'
  },
]

export function FeaturesSection() {
  return (
    <section id="features" className="py-20 px-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold mb-4">Powerful Features</h2>
          <p className="text-xl text-foreground/70 max-w-2xl mx-auto">
            Everything you need to create, deploy, and manage your AI digital twin.
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, idx) => {
            const Icon = feature.icon
            return (
              <Card key={idx} className="card-hover group">
                <CardContent className="pt-6">
                  <div className="w-12 h-12 rounded-lg bg-gradient-primary flex items-center justify-center mb-4 group-hover:shadow-lg group-hover:shadow-purple-500/20 transition-all">
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                  <p className="text-foreground/60">{feature.description}</p>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>
    </section>
  )
}
