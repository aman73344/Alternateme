export type IntegrationCapability =
  'google_calendar_list_events' | 'google_gmail_search_messages' | 'google_tasks_list';

export interface GoogleTokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
  token_type: string;
}

export interface GoogleCredentials {
  accessToken: string;
  refreshToken?: string;
  expiresAt: string;
}

export interface GoogleAccount {
  email: string;
}

export interface IntegrationCapabilityInput {
  google_calendar_list_events: {
    timeMin?: string;
    timeMax?: string;
    limit: number;
  };
  google_gmail_search_messages: {
    query: string;
    limit: number;
  };
  google_tasks_list: {
    limit: number;
  };
}

export interface GoogleCalendarEvent {
  id: string;
  summary: string;
  start?: string;
  end?: string;
  htmlLink?: string;
}

export interface GoogleGmailMessage {
  id: string;
  threadId?: string;
  from?: string;
  subject?: string;
  date?: string;
  snippet?: string;
}

export interface GoogleTask {
  id: string;
  title: string;
  status?: string;
  due?: string;
  notes?: string;
}

export type GoogleCalendarListInput = IntegrationCapabilityInput['google_calendar_list_events'];
export type GoogleGmailSearchInput = IntegrationCapabilityInput['google_gmail_search_messages'];
export type GoogleTasksListInput = IntegrationCapabilityInput['google_tasks_list'];
