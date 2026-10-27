import { createHash } from 'crypto';
import { config } from '@/config';
import { BusinessError, ProviderError } from '@/utils/errors';
import { GOOGLE_API_BASE_URL, GOOGLE_INTEGRATION_SCOPES } from './constants';
import type {
  GoogleAccount,
  GoogleCalendarEvent,
  GoogleGmailMessage,
  GoogleTask,
  GoogleTokenResponse,
  IntegrationCapability,
  IntegrationCapabilityInput,
} from './types';

interface GoogleCalendarListResponse {
  items?: Array<{
    id?: string;
    summary?: string;
    start?: { dateTime?: string; date?: string };
    end?: { dateTime?: string; date?: string };
    htmlLink?: string;
  }>;
}

interface GoogleGmailListResponse {
  messages?: Array<{ id: string; threadId?: string }>;
}

interface GoogleGmailMessageResponse {
  id: string;
  threadId?: string;
  snippet?: string;
  payload?: {
    headers?: Array<{ name: string; value: string }>;
  };
}

interface GoogleTaskListsResponse {
  items?: Array<{ id: string }>;
}

interface GoogleTasksResponse {
  items?: Array<{
    id: string;
    title?: string;
    status?: string;
    due?: string;
    notes?: string;
  }>;
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, { ...init, signal: AbortSignal.timeout(15_000) });
  } catch {
    throw new ProviderError('Google request could not be completed', 'google');
  }

  if (!response.ok) {
    throw new ProviderError(
      'Google rejected the integration request',
      'google',
      response.status === 401 ? 401 : 502,
    );
  }
  return (await response.json()) as T;
}

export class GoogleIntegrationAdapter {
  createAuthorizationUrl(state: string, codeVerifier: string): string {
    const challenge = createHash('sha256').update(codeVerifier).digest('base64url');
    const params = new URLSearchParams({
      client_id: config.oauth.google.clientId,
      redirect_uri: config.oauth.google.integrationsRedirectUri,
      response_type: 'code',
      scope: GOOGLE_INTEGRATION_SCOPES.join(' '),
      access_type: 'offline',
      prompt: 'consent',
      include_granted_scopes: 'true',
      state,
      code_challenge: challenge,
      code_challenge_method: 'S256',
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  async exchangeCode(code: string, codeVerifier: string): Promise<GoogleTokenResponse> {
    return requestJson<GoogleTokenResponse>('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        code_verifier: codeVerifier,
        client_id: config.oauth.google.clientId,
        client_secret: config.oauth.google.clientSecret,
        redirect_uri: config.oauth.google.integrationsRedirectUri,
        grant_type: 'authorization_code',
      }),
    });
  }

  async refreshAccessToken(refreshToken: string): Promise<GoogleTokenResponse> {
    return requestJson<GoogleTokenResponse>('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        refresh_token: refreshToken,
        client_id: config.oauth.google.clientId,
        client_secret: config.oauth.google.clientSecret,
        grant_type: 'refresh_token',
      }),
    });
  }

  async revokeToken(token: string): Promise<boolean> {
    let response: Response;
    try {
      response = await fetch('https://oauth2.googleapis.com/revoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ token }),
        signal: AbortSignal.timeout(10_000),
      });
    } catch {
      return false;
    }
    return response.ok;
  }

  async getAccount(accessToken: string): Promise<GoogleAccount> {
    const profile = await requestJson<{ email?: string }>(
      `${GOOGLE_API_BASE_URL}/oauth2/v3/userinfo`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );
    if (!profile.email) {
      throw new ProviderError('Google account email is unavailable', 'google');
    }
    return { email: profile.email };
  }

  async execute<TCapability extends IntegrationCapability>(
    accessToken: string,
    capability: TCapability,
    input: IntegrationCapabilityInput[TCapability],
  ): Promise<unknown> {
    switch (capability) {
      case 'google_calendar_list_events':
        return this.listCalendarEvents(
          accessToken,
          input as IntegrationCapabilityInput['google_calendar_list_events'],
        );
      case 'google_gmail_search_messages':
        return this.searchGmailMessages(
          accessToken,
          input as IntegrationCapabilityInput['google_gmail_search_messages'],
        );
      case 'google_tasks_list':
        return this.listTasks(
          accessToken,
          input as IntegrationCapabilityInput['google_tasks_list'],
        );
      default: {
        const exhaustive: never = capability;
        throw new ProviderError(`Unsupported Google capability: ${exhaustive}`, 'google');
      }
    }
  }

  private async listCalendarEvents(
    accessToken: string,
    input: IntegrationCapabilityInput['google_calendar_list_events'],
  ): Promise<GoogleCalendarEvent[]> {
    if (input.timeMin && input.timeMax && new Date(input.timeMin) > new Date(input.timeMax)) {
      throw new BusinessError('timeMin must not be later than timeMax', 'INVALID_CALENDAR_RANGE');
    }
    const params = new URLSearchParams({
      maxResults: String(input.limit),
      singleEvents: 'true',
      orderBy: 'startTime',
      timeMin: input.timeMin ?? new Date().toISOString(),
    });
    if (input.timeMax) params.set('timeMax', input.timeMax);
    const result = await requestJson<GoogleCalendarListResponse>(
      `${GOOGLE_API_BASE_URL}/calendar/v3/calendars/primary/events?${params.toString()}`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );

    return (result.items ?? []).flatMap((item) =>
      item.id
        ? [
            {
              id: item.id,
              summary: item.summary ?? '(no title)',
              start: item.start?.dateTime ?? item.start?.date,
              end: item.end?.dateTime ?? item.end?.date,
              htmlLink: item.htmlLink,
            },
          ]
        : [],
    );
  }

  private async searchGmailMessages(
    accessToken: string,
    input: IntegrationCapabilityInput['google_gmail_search_messages'],
  ): Promise<GoogleGmailMessage[]> {
    const params = new URLSearchParams({
      q: input.query,
      maxResults: String(input.limit),
    });
    const result = await requestJson<GoogleGmailListResponse>(
      `${GOOGLE_API_BASE_URL}/gmail/v1/users/me/messages?${params.toString()}`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );

    const messages = result.messages ?? [];
    return Promise.all(
      messages.map(async ({ id }) => {
        const details = await requestJson<GoogleGmailMessageResponse>(
          `${GOOGLE_API_BASE_URL}/gmail/v1/users/me/messages/${encodeURIComponent(id)}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`,
          { headers: { Authorization: `Bearer ${accessToken}` } },
        );
        const header = (name: string) =>
          details.payload?.headers?.find((item) => item.name.toLowerCase() === name.toLowerCase())
            ?.value;
        return {
          id: details.id,
          threadId: details.threadId,
          from: header('From'),
          subject: header('Subject'),
          date: header('Date'),
          snippet: details.snippet,
        };
      }),
    );
  }

  private async listTasks(
    accessToken: string,
    input: IntegrationCapabilityInput['google_tasks_list'],
  ): Promise<GoogleTask[]> {
    const headers = { Authorization: `Bearer ${accessToken}` };
    const taskLists = await requestJson<GoogleTaskListsResponse>(
      `${GOOGLE_API_BASE_URL}/tasks/v1/users/@me/lists?maxResults=1`,
      { headers },
    );
    const taskListId = taskLists.items?.[0]?.id;
    if (!taskListId) return [];

    const params = new URLSearchParams({ maxResults: String(input.limit), showCompleted: 'true' });
    const result = await requestJson<GoogleTasksResponse>(
      `${GOOGLE_API_BASE_URL}/tasks/v1/lists/${encodeURIComponent(taskListId)}/tasks?${params.toString()}`,
      { headers },
    );
    return (result.items ?? []).map((task) => ({
      id: task.id,
      title: task.title ?? '(no title)',
      status: task.status,
      due: task.due,
      notes: task.notes,
    }));
  }
}

export const googleIntegrationAdapter = new GoogleIntegrationAdapter();
