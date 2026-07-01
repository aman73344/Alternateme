'use client'

import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Check } from 'lucide-react'

const plans = [
  {
    name: 'Starter',
    price: '29',
    description: 'Perfect for getting started',
    features: [
      'Create 1 digital twin',
      'Basic knowledge base (up to 50MB)',
      'Chat widget only',
      'Up to 1,000 conversations/month',
      'Basic analytics',
      'Email support',
    ],
    highlighted: false,
  },
  {
    name: 'Professional',
    price: '99',
    description: 'For growing teams',
    features: [
      'Create up to 5 digital twins',
      'Advanced knowledge base (up to 2GB)',
      'Chat, email, and voice channels',
      'Up to 50,000 conversations/month',
      'Advanced analytics & insights',
      'Priority email support',
      'Custom branding options',
      'API access',
    ],
    highlighted: true,
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    description: 'For large organizations',
    features: [
      'Unlimited digital twins',
      'Unlimited knowledge base',
      'All channels (chat, email, voice, phone, web)',
      'Unlimited conversations',
      'Real-time analytics',
      '24/7 phone support',
      'Custom integrations',
      'Dedicated account manager',
      'SLA guarantee',
    ],
    highlighted: false,
  },
]

export function PricingSection() {
  return (
    <section id="pricing" className="py-20 px-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold mb-4">Simple, Transparent Pricing</h2>
          <p className="text-xl text-foreground/70 max-w-2xl mx-auto">
            Choose the perfect plan for your needs. Always flexible, no hidden fees.
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {plans.map((plan, idx) => (
            <Card
              key={idx}
              className={`card-hover flex flex-col ${
                plan.highlighted ? 'md:scale-105 border-primary/50' : ''
              }`}
            >
              <CardHeader>
                <CardTitle>{plan.name}</CardTitle>
                <p className="text-foreground/60 text-sm mt-2">{plan.description}</p>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col">
                <div className="mb-6">
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-bold">${plan.price}</span>
                    {plan.price !== 'Custom' && <span className="text-foreground/60">/month</span>}
                  </div>
                </div>

                <Button
                  asChild
                  className={`mb-6 ${
                    plan.highlighted
                      ? 'bg-gradient-primary hover:opacity-90'
                      : 'border-border'
                  }`}
                  variant={plan.highlighted ? 'default' : 'outline'}
                  size="lg"
                >
                  <Link href="/signup">
                    {plan.price === 'Custom' ? 'Contact Sales' : 'Get Started'}
                  </Link>
                </Button>

                <div className="space-y-3">
                  {plan.features.map((feature, fIdx) => (
                    <div key={fIdx} className="flex items-start gap-3">
                      <Check className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                      <span className="text-sm text-foreground/70">{feature}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}
