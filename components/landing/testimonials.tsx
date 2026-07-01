'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Star } from 'lucide-react'

const testimonials = [
  {
    name: 'Sarah Chen',
    role: 'Founder, TechConsult',
    content: 'Alternate Me has been a game changer for our consulting business. We can now handle client inquiries 24/7 without hiring additional staff.',
    avatar: '👩‍💼',
    rating: 5,
  },
  {
    name: 'Marcus Johnson',
    role: 'CEO, Growth Labs',
    content: 'The voice interface is incredibly natural. Clients often can\'t tell they\'re talking to an AI. This has transformed our customer support.',
    avatar: '👨‍💼',
    rating: 5,
  },
  {
    name: 'Emma Rodriguez',
    role: 'Author & Speaker',
    content: 'As someone constantly in demand, having my AI twin handle scheduling and basic questions has freed up hours each week.',
    avatar: '👩‍🎓',
    rating: 5,
  },
]

export function TestimonialsSection() {
  return (
    <section className="py-20 px-6 bg-secondary/30">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold mb-4">Loved by Teams Worldwide</h2>
          <p className="text-xl text-foreground/70 max-w-2xl mx-auto">
            See what our customers have to say about Alternate Me.
          </p>
        </div>

        {/* Testimonials Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {testimonials.map((testimonial, idx) => (
            <Card key={idx} className="card-hover">
              <CardContent className="pt-6">
                {/* Rating */}
                <div className="flex gap-1 mb-4">
                  {Array.from({ length: testimonial.rating }).map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>

                {/* Content */}
                <p className="text-foreground/70 mb-6 text-sm leading-relaxed">
                  &quot;{testimonial.content}&quot;
                </p>

                {/* Author */}
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-primary flex items-center justify-center text-lg">
                    {testimonial.avatar}
                  </div>
                  <div>
                    <p className="font-semibold text-sm">{testimonial.name}</p>
                    <p className="text-foreground/60 text-xs">{testimonial.role}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}
