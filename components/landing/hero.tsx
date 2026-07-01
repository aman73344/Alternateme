'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ArrowRight, Zap } from 'lucide-react'

export function HeroSection() {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-20">
      {/* Background effects */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-20 left-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-1/4 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl" />
      </div>

      <div className="max-w-7xl mx-auto px-6 text-center">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-secondary/50 border border-border mb-6 animate-slideUp">
          <Zap className="w-4 h-4 text-primary" />
          <span className="text-xs font-semibold">Introducing Alternate Me</span>
        </div>

        {/* Main headline */}
        <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-tight animate-slideUp" style={{ animationDelay: '0.1s' }}>
          Your AI Digital Twin,{' '}
          <span className="text-gradient">Always On</span>
        </h1>

        {/* Subheading */}
        <p className="text-xl md:text-2xl text-foreground/70 mb-8 max-w-2xl mx-auto leading-relaxed animate-slideUp" style={{ animationDelay: '0.2s' }}>
          Create an AI-powered version of yourself that answers questions, communicates in your voice, and operates 24/7 across chat, email, voice, phone, and your website.
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12 animate-slideUp" style={{ animationDelay: '0.3s' }}>
          <Link href="/signup">
            <Button size="lg" className="bg-gradient-primary hover:opacity-90 text-white gap-2">
              Get Started Free
              <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
          <Button size="lg" variant="outline" className="border-border">
            Watch Demo
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-8 mt-16 pt-12 border-t border-border animate-slideUp" style={{ animationDelay: '0.4s' }}>
          <div>
            <div className="text-3xl font-bold text-gradient mb-2">500+</div>
            <p className="text-sm text-foreground/60">Active Users</p>
          </div>
          <div>
            <div className="text-3xl font-bold text-gradient mb-2">2.5M+</div>
            <p className="text-sm text-foreground/60">Conversations</p>
          </div>
          <div>
            <div className="text-3xl font-bold text-gradient mb-2">99.9%</div>
            <p className="text-sm text-foreground/60">Uptime</p>
          </div>
        </div>
      </div>
    </section>
  )
}
