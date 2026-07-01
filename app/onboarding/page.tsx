'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { ProgressBar } from '@/components/shared/progress-bar'
import { ArrowRight, ArrowLeft, Upload, CheckCircle2, Zap } from 'lucide-react'

type Step = 1 | 2 | 3 | 4 | 5 | 6

interface OnboardingData {
  personalInfo: {
    name: string
    title: string
    bio: string
    website: string
  }
  knowledgeSources: {
    documents: string[]
    faqs: string
    website: string
  }
  persona: {
    personality: string[]
    tone: string
    expertise: string[]
  }
  voice: {
    voiceFile: string
    accentPreference: string
  }
  aiProvider: {
    provider: string
    model: string
  }
  publish: {
    twinName: string
    isPublic: boolean
  }
}

export default function Onboarding() {
  const [currentStep, setCurrentStep] = useState<Step>(1)
  const [data, setData] = useState<OnboardingData>({
    personalInfo: { name: '', title: '', bio: '', website: '' },
    knowledgeSources: { documents: [], faqs: '', website: '' },
    persona: { personality: [], tone: '', expertise: [] },
    voice: { voiceFile: '', accentPreference: '' },
    aiProvider: { provider: '', model: '' },
    publish: { twinName: '', isPublic: false },
  })

  const steps = [
    { number: 1, title: 'Personal Info', description: 'Tell us about yourself' },
    { number: 2, title: 'Knowledge Sources', description: 'Add your knowledge' },
    { number: 3, title: 'Persona Config', description: 'Define your character' },
    { number: 4, title: 'Voice Setup', description: 'Clone your voice' },
    { number: 5, title: 'AI Provider', description: 'Choose engine' },
    { number: 6, title: 'Publish', description: 'Go live' },
  ]

  const handleNext = () => {
    if (currentStep < 6) {
      setCurrentStep((currentStep + 1) as Step)
    }
  }

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep((currentStep - 1) as Step)
    }
  }

  const progressPercentage = (currentStep / 6) * 100

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-secondary/20">
      {/* Header */}
      <div className="border-b border-border bg-card/50 backdrop-blur sticky top-0 z-40">
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-4">
            <Link href="/" className="inline-flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center">
                <Zap className="w-5 h-5 text-white" />
              </div>
              <span className="font-bold">Alternate Me</span>
            </Link>
            <div className="text-sm text-muted-foreground">
              Step {currentStep} of 6
            </div>
          </div>
          <ProgressBar current={currentStep} total={6} />
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-4">
          {/* Sidebar Steps */}
          <div className="hidden lg:block">
            <div className="space-y-3 sticky top-32">
              {steps.map((step) => (
                <button
                  key={step.number}
                  onClick={() => setCurrentStep(step.number as Step)}
                  className={`w-full text-left p-3 rounded-lg transition-all ${
                    currentStep === step.number
                      ? 'bg-primary/10 border border-primary text-primary'
                      : step.number < currentStep
                      ? 'bg-card/50 border border-border text-foreground hover:bg-card'
                      : 'bg-card/30 border border-border text-muted-foreground hover:bg-card/50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold ${
                      currentStep === step.number
                        ? 'bg-primary text-primary-foreground'
                        : step.number < currentStep
                        ? 'bg-primary/20 text-primary'
                        : 'bg-muted text-muted-foreground'
                    }`}>
                      {step.number < currentStep ? '✓' : step.number}
                    </div>
                    <div>
                      <div className="text-sm font-medium">{step.title}</div>
                      <div className="text-xs text-muted-foreground">{step.description}</div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3">
            {currentStep === 1 && <Step1 data={data} setData={setData} />}
            {currentStep === 2 && <Step2 data={data} setData={setData} />}
            {currentStep === 3 && <Step3 data={data} setData={setData} />}
            {currentStep === 4 && <Step4 data={data} setData={setData} />}
            {currentStep === 5 && <Step5 data={data} setData={setData} />}
            {currentStep === 6 && <Step6 data={data} setData={setData} />}

            {/* Navigation */}
            <div className="mt-12 flex gap-4">
              <Button
                variant="outline"
                onClick={handlePrevious}
                disabled={currentStep === 1}
              >
                Previous
              </Button>
              {currentStep === 6 ? (
                <Button
                  className="flex-1 bg-gradient-primary hover:opacity-90"
                  asChild
                >
                  <Link href="/dashboard">
                    Complete & Go to Dashboard
                  </Link>
                </Button>
              ) : (
                <Button
                  className="flex-1 bg-gradient-primary hover:opacity-90"
                  onClick={handleNext}
                >
                  Next
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// Step Components
function Step1({ data, setData }: any) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground mb-2">Personal Information</h2>
        <p className="text-muted-foreground">Tell us about yourself</p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">Full Name *</label>
          <input
            type="text"
            placeholder="Your name"
            value={data.personalInfo.name}
            onChange={(e) => setData({
              ...data,
              personalInfo: { ...data.personalInfo, name: e.target.value }
            })}
            className="w-full px-4 py-2 rounded-lg border border-border bg-input text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-2">Professional Title *</label>
          <input
            type="text"
            placeholder="e.g., CEO, Coach, Consultant"
            value={data.personalInfo.title}
            onChange={(e) => setData({
              ...data,
              personalInfo: { ...data.personalInfo, title: e.target.value }
            })}
            className="w-full px-4 py-2 rounded-lg border border-border bg-input text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-2">Bio *</label>
          <textarea
            placeholder="Tell us about your background, expertise, and what you do"
            rows={4}
            value={data.personalInfo.bio}
            onChange={(e) => setData({
              ...data,
              personalInfo: { ...data.personalInfo, bio: e.target.value }
            })}
            className="w-full px-4 py-2 rounded-lg border border-border bg-input text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-2">Website URL</label>
          <input
            type="url"
            placeholder="https://yourwebsite.com"
            value={data.personalInfo.website}
            onChange={(e) => setData({
              ...data,
              personalInfo: { ...data.personalInfo, website: e.target.value }
            })}
            className="w-full px-4 py-2 rounded-lg border border-border bg-input text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
      </div>

      <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
        <p className="text-sm text-muted-foreground">
          ℹ️ This information helps your digital twin understand your background and communicate authentically.
        </p>
      </div>
    </div>
  )
}

function Step2({ data, setData }: any) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground mb-2">Knowledge Sources</h2>
        <p className="text-muted-foreground">Train your twin with your knowledge</p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">Upload Documents</label>
          <div className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors">
            <p className="text-muted-foreground">Drag and drop files or click to upload</p>
            <p className="text-xs text-muted-foreground mt-2">PDF, DOC, TXT up to 25MB each</p>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-2">FAQ Content</label>
          <textarea
            placeholder="Paste your frequently asked questions and answers"
            rows={4}
            value={data.knowledgeSources.faqs}
            onChange={(e) => setData({
              ...data,
              knowledgeSources: { ...data.knowledgeSources, faqs: e.target.value }
            })}
            className="w-full px-4 py-2 rounded-lg border border-border bg-input text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-2">Website URL to Crawl</label>
          <input
            type="url"
            placeholder="https://yourwebsite.com"
            value={data.knowledgeSources.website}
            onChange={(e) => setData({
              ...data,
              knowledgeSources: { ...data.knowledgeSources, website: e.target.value }
            })}
            className="w-full px-4 py-2 rounded-lg border border-border bg-input text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
      </div>

      <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
        <p className="text-sm text-muted-foreground">
          ℹ️ Your twin uses this knowledge to provide accurate responses. You can add more sources later.
        </p>
      </div>
    </div>
  )
}

function Step3({ data, setData }: any) {
  const personalityOptions = ['Professional', 'Friendly', 'Humorous', 'Empathetic', 'Creative', 'Analytical']
  const toneOptions = ['Formal', 'Casual', 'Technical', 'Conversational', 'Inspirational']

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground mb-2">Persona Configuration</h2>
        <p className="text-muted-foreground">Define your twin&apos;s personality</p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-foreground mb-3">Personality Traits</label>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {personalityOptions.map((trait) => (
              <button
                key={trait}
                onClick={() => setData({
                  ...data,
                  persona: {
                    ...data.persona,
                    personality: data.persona.personality.includes(trait)
                      ? data.persona.personality.filter((t: string) => t !== trait)
                      : [...data.persona.personality, trait]
                  }
                })}
                className={`px-4 py-2 rounded-lg border transition-all text-sm font-medium ${
                  data.persona.personality.includes(trait)
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border bg-card text-foreground hover:border-primary/50'
                }`}
              >
                {trait}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-3">Communication Tone</label>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {toneOptions.map((tone) => (
              <button
                key={tone}
                onClick={() => setData({
                  ...data,
                  persona: { ...data.persona, tone }
                })}
                className={`px-4 py-2 rounded-lg border transition-all text-sm font-medium ${
                  data.persona.tone === tone
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border bg-card text-foreground hover:border-primary/50'
                }`}
              >
                {tone}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-2">Areas of Expertise</label>
          <input
            type="text"
            placeholder="e.g., Business Strategy, Coaching, Technology"
            value={data.persona.expertise.join(', ')}
            onChange={(e) => setData({
              ...data,
              persona: { ...data.persona, expertise: e.target.value.split(',').map(s => s.trim()) }
            })}
            className="w-full px-4 py-2 rounded-lg border border-border bg-input text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
      </div>

      <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
        <p className="text-sm text-muted-foreground">
          ℹ️ These traits shape how your twin responds to interactions. You can adjust them anytime.
        </p>
      </div>
    </div>
  )
}

function Step4({ data, setData }: any) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground mb-2">Voice Setup</h2>
        <p className="text-muted-foreground">Clone your voice for authentic interactions</p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">Upload Voice Sample (30 seconds minimum)</label>
          <div className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors">
            <p className="text-muted-foreground">🎙️ Drag and drop audio or click to upload</p>
            <p className="text-xs text-muted-foreground mt-2">MP3, WAV, M4A up to 50MB</p>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-2">Accent Preference</label>
          <select
            value={data.voice.accentPreference}
            onChange={(e) => setData({
              ...data,
              voice: { ...data.voice, accentPreference: e.target.value }
            })}
            className="w-full px-4 py-2 rounded-lg border border-border bg-input text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">Select accent...</option>
            <option value="american">American</option>
            <option value="british">British</option>
            <option value="australian">Australian</option>
            <option value="neutral">Neutral</option>
          </select>
        </div>
      </div>

      <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
        <p className="text-sm text-muted-foreground">
          ℹ️ Your voice sample will be cloned using AI technology. The quality of the sample affects accuracy.
        </p>
      </div>
    </div>
  )
}

function Step5({ data, setData }: any) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground mb-2">AI Provider Selection</h2>
        <p className="text-muted-foreground">Choose your AI engine</p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-foreground mb-3">Provider</label>
          <div className="space-y-2">
            {[
              { id: 'gpt4', name: 'OpenAI GPT-4', description: 'Advanced reasoning and creativity' },
              { id: 'claude', name: 'Anthropic Claude', description: 'Nuanced and detailed responses' },
              { id: 'gemini', name: 'Google Gemini', description: 'Fast and efficient' },
            ].map((provider) => (
              <button
                key={provider.id}
                onClick={() => setData({
                  ...data,
                  aiProvider: { ...data.aiProvider, provider: provider.id }
                })}
                className={`w-full text-left p-4 rounded-lg border transition-all ${
                  data.aiProvider.provider === provider.id
                    ? 'border-primary bg-primary/5'
                    : 'border-border bg-card hover:border-primary/50'
                }`}
              >
                <div className="font-medium text-foreground">{provider.name}</div>
                <div className="text-sm text-muted-foreground">{provider.description}</div>
              </button>
            ))}
          </div>
        </div>

        {data.aiProvider.provider && (
          <div>
            <label className="block text-sm font-medium text-foreground mb-3">Model</label>
            <select
              value={data.aiProvider.model}
              onChange={(e) => setData({
                ...data,
                aiProvider: { ...data.aiProvider, model: e.target.value }
              })}
              className="w-full px-4 py-2 rounded-lg border border-border bg-input text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">Select model...</option>
              <option value="latest">Latest (Recommended)</option>
              <option value="stable">Stable</option>
              <option value="advanced">Advanced</option>
            </select>
          </div>
        )}
      </div>

      <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
        <p className="text-sm text-muted-foreground">
          ℹ️ You can change your AI provider anytime. Different providers have different strengths.
        </p>
      </div>
    </div>
  )
}

function Step6({ data, setData }: any) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground mb-2">Publish Your Twin</h2>
        <p className="text-muted-foreground">Launch your digital twin</p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">Twin Name *</label>
          <input
            type="text"
            placeholder="e.g., John Doe - Expert"
            value={data.publish.twinName}
            onChange={(e) => setData({
              ...data,
              publish: { ...data.publish, twinName: e.target.value }
            })}
            className="w-full px-4 py-2 rounded-lg border border-border bg-input text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        <button
          onClick={() => setData({
            ...data,
            publish: { ...data.publish, isPublic: !data.publish.isPublic }
          })}
          className={`w-full text-left p-4 rounded-lg border transition-all flex items-center justify-between ${
            data.publish.isPublic
              ? 'border-primary bg-primary/5'
              : 'border-border bg-card hover:border-primary/50'
          }`}
        >
          <div>
            <div className="font-medium text-foreground">Public Profile</div>
            <div className="text-sm text-muted-foreground">Allow others to find your twin</div>
          </div>
          <div className={`w-6 h-6 rounded-full border-2 transition-all ${
            data.publish.isPublic
              ? 'border-primary bg-primary'
              : 'border-border'
          }`}></div>
        </button>
      </div>

      <div className="p-4 rounded-lg bg-card border border-border space-y-3">
        <h3 className="font-medium text-foreground">✓ Your Setup is Ready</h3>
        <div className="text-sm text-muted-foreground space-y-2">
          <p>✓ Personal information configured</p>
          <p>✓ Knowledge base uploaded</p>
          <p>✓ Persona traits set</p>
          <p>✓ Voice cloned</p>
          <p>✓ AI provider selected</p>
        </div>
        <p className="text-sm text-muted-foreground mt-4">Click "Complete & Go to Dashboard" to start using your twin!</p>
      </div>

      <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
        <p className="text-sm text-muted-foreground">
          ℹ️ Your twin will be available immediately. You can customize it further from the dashboard.
        </p>
      </div>
    </div>
  )
}
