export const INTEGRATION_PROVIDER = 'google' as const;

export const GOOGLE_INTEGRATION_SCOPES = [
  'openid',
  'email',
  'https://www.googleapis.com/auth/calendar.events.readonly',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/tasks.readonly',
] as const;

export const INTEGRATION_OAUTH_STATE_TTL_MS = 10 * 60 * 1000;

export const INTEGRATION_CAPABILITIES = {
  LIST_CALENDAR_EVENTS: 'google_calendar_list_events',
  SEARCH_GMAIL_MESSAGES: 'google_gmail_search_messages',
  LIST_TASKS: 'google_tasks_list',
} as const;

export const GOOGLE_API_BASE_URL = 'https://www.googleapis.com';
