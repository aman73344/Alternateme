// Ordered list of onboarding steps for progression validation
// Using a const object so OnboardingStep works as both a type and value
// without relying on generated Prisma enum exports.
export const OnboardingStep = {
  PERSONAL: 'PERSONAL',
  SOURCES: 'SOURCES',
  PERSONA: 'PERSONA',
  VOICE: 'VOICE',
  AI_PROVIDER: 'AI_PROVIDER',
  PUBLISH: 'PUBLISH',
} as const;

export type OnboardingStep = (typeof OnboardingStep)[keyof typeof OnboardingStep];

export const ONBOARDING_STEP_ORDER: OnboardingStep[] = [
  OnboardingStep.PERSONAL,
  OnboardingStep.SOURCES,
  OnboardingStep.PERSONA,
  OnboardingStep.VOICE,
  OnboardingStep.AI_PROVIDER,
  OnboardingStep.PUBLISH,
];

// Steps required for a valid publish
export const REQUIRED_STEPS_FOR_PUBLISH: OnboardingStep[] = [
  OnboardingStep.PERSONAL,
  OnboardingStep.PERSONA,
  OnboardingStep.AI_PROVIDER,
];

// Reserved usernames that cannot be claimed by alternates
export const RESERVED_USERNAMES: string[] = [
  'admin',
  'administrator',
  'api',
  'app',
  'apps',
  'auth',
  'blog',
  'billing',
  'careers',
  'cdn',
  'chat',
  'contact',
  'dashboard',
  'dev',
  'docs',
  'download',
  'downloads',
  'email',
  'events',
  'faq',
  'feature',
  'features',
  'feedback',
  'forum',
  'help',
  'home',
  'imprint',
  'info',
  'jobs',
  'legal',
  'login',
  'logout',
  'mail',
  'media',
  'news',
  'newsletter',
  'notifications',
  'oauth',
  'openapi',
  'pricing',
  'privacy',
  'profile',
  'profiles',
  'public',
  'register',
  'root',
  'search',
  'security',
  'settings',
  'signin',
  'signup',
  'sitemap',
  'status',
  'support',
  'system',
  'terms',
  'tos',
  'user',
  'users',
  'widgets',
  'www',
];