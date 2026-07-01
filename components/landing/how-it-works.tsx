'use client'

import { Card, CardContent } from '@/components/ui/card'
import { CheckCircle2, Upload, Settings, Zap } from 'lucide-react'

const steps = [
  {
    number: '1',
    icon: Upload,
    title: 'Upload Your Knowledge',
    description: 'Add documents, videos, website content, or manual information about yourself.'
  },
  {
    number: '2',
    icon: Settings,
    title: 'Configure Your Twin',
    description: 'Customize personality, tone, knowledge sources, and AI provider preferences.'
  },
  {
    number: '3',
    icon: CheckCircle2,
    title: 'Train & Publish',
    description: 'Let the AI learn from your data and publish your digital twin online.'
  },
  {
    number: '4',
    icon: Zap,
    title: 'Deploy Everywhere',
    description: 'Embed on your website, integrate with email, enable phone calls, and more.'
  },
]

export function HowItWorksSection() {
  return (
    <section id="how" className="py-20 px-6 bg-secondary/30">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold mb-4">How It Works</h2>
          <p className="text-xl text-foreground/70 max-w-2xl mx-auto">
            Get your AI digital twin up and running in just a few simple steps.
          </p>
        </div>

        {/* Steps */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {steps.map((step, idx) => {
            const Icon = step.icon
            return (
              <div key={idx} className="relative">
                <Card className="card-hover h-full">
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-4 mb-4">
                      <div className="w-10 h-10 rounded-full bg-gradient-primary flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                        {step.number}
                      </div>
                      <Icon className="w-6 h-6 text-primary flex-shrink-0" />
                    </div>
                    <h3 className="text-lg font-semibold mb-2">{step.title}</h3>
                    <p className="text-foreground/60 text-sm">{step.description}</p>
                  </CardContent>
                </Card>
                
                {/* Connector line */}
                {idx < steps.length - 1 && (
                  <div className="hidden lg:block absolute top-1/2 -right-3 w-6 h-0.5 bg-gradient-to-r from-primary/50 to-transparent" />
                )}
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
