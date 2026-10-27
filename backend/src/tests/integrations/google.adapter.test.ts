import { createHash } from 'crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { googleIntegrationAdapter } from '@/integrations/google.adapter';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('GoogleIntegrationAdapter', () => {
  it('creates a PKCE authorization URL with read-only Google scopes', () => {
    const verifier = 'test-code-verifier';
    const authorizationUrl = new URL(
      googleIntegrationAdapter.createAuthorizationUrl('state-value', verifier),
    );

    expect(authorizationUrl.searchParams.get('state')).toBe('state-value');
    expect(authorizationUrl.searchParams.get('code_challenge_method')).toBe('S256');
    expect(authorizationUrl.searchParams.get('code_challenge')).toBe(
      createHash('sha256').update(verifier).digest('base64url'),
    );
    expect(authorizationUrl.searchParams.get('scope')).toContain(
      'https://www.googleapis.com/auth/gmail.readonly',
    );
    expect(authorizationUrl.searchParams.get('scope')).not.toContain('gmail.send');
  });

  it('requests and normalizes calendar events', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        items: [
          {
            id: 'event-1',
            summary: 'Planning',
            start: { dateTime: '2026-10-28T10:00:00Z' },
            end: { dateTime: '2026-10-28T11:00:00Z' },
          },
        ],
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const events = await googleIntegrationAdapter.execute(
      'access-token',
      'google_calendar_list_events',
      { limit: 3, timeMin: '2026-10-28T00:00:00Z' },
    );

    expect(events).toEqual([
      {
        id: 'event-1',
        summary: 'Planning',
        start: '2026-10-28T10:00:00Z',
        end: '2026-10-28T11:00:00Z',
        htmlLink: undefined,
      },
    ]);
    expect(fetchMock.mock.calls[0][0]).toContain('maxResults=3');
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer access-token');
  });

  it('returns only selected message metadata from Gmail search', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({ messages: [{ id: 'message-1', threadId: 'thread-1' }] }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          id: 'message-1',
          threadId: 'thread-1',
          snippet: 'A short preview',
          payload: {
            headers: [
              { name: 'From', value: 'sender@example.test' },
              { name: 'Subject', value: 'A subject' },
              { name: 'Date', value: 'Tue, 27 Oct 2026 10:00:00 +0000' },
            ],
          },
        }),
      );
    vi.stubGlobal('fetch', fetchMock);

    const messages = await googleIntegrationAdapter.execute(
      'access-token',
      'google_gmail_search_messages',
      { query: 'from:sender@example.test', limit: 1 },
    );

    expect(messages).toEqual([
      {
        id: 'message-1',
        threadId: 'thread-1',
        from: 'sender@example.test',
        subject: 'A subject',
        date: 'Tue, 27 Oct 2026 10:00:00 +0000',
        snippet: 'A short preview',
      },
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][0]).toContain('q=from%3Asender%40example.test');
  });

  it('reads tasks from the first Google Tasks list', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ items: [{ id: 'list-1' }] }))
      .mockResolvedValueOnce(
        jsonResponse({
          items: [{ id: 'task-1', title: 'Review', status: 'needsAction' }],
        }),
      );
    vi.stubGlobal('fetch', fetchMock);

    const tasks = await googleIntegrationAdapter.execute('access-token', 'google_tasks_list', {
      limit: 5,
    });

    expect(tasks).toEqual([
      {
        id: 'task-1',
        title: 'Review',
        status: 'needsAction',
        due: undefined,
        notes: undefined,
      },
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not hide Google API failures', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({}, 403)));

    await expect(
      googleIntegrationAdapter.execute('access-token', 'google_tasks_list', { limit: 5 }),
    ).rejects.toMatchObject({ code: 'GOOGLE_ERROR' });
  });
});
