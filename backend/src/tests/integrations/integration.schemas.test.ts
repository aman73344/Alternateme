import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { registerBuiltInTools, resetToolRegistration, toolRegistry } from '@/agent/tools';
import { ToolRiskLevel } from '@/agent/agent.types';
import {
  GoogleCalendarListEventsInputSchema,
  GoogleGmailSearchMessagesInputSchema,
  GoogleTasksListInputSchema,
} from '@/agent/tools/tool.schemas';

describe('Google integration tool input schemas', () => {
  beforeEach(() => resetToolRegistration());
  afterEach(() => resetToolRegistration());

  it('validates bounded calendar event queries', () => {
    expect(GoogleCalendarListEventsInputSchema.parse({ limit: 3 })).toEqual({ limit: 3 });
    expect(GoogleCalendarListEventsInputSchema.safeParse({ limit: 11 }).success).toBe(false);
    expect(GoogleCalendarListEventsInputSchema.safeParse({ limit: 1, extra: true }).success).toBe(
      false,
    );
  });

  it('requires a non-empty Gmail query and rejects unknown fields', () => {
    expect(GoogleGmailSearchMessagesInputSchema.safeParse({ query: 'from:me' }).success).toBe(true);
    expect(GoogleGmailSearchMessagesInputSchema.safeParse({ query: '  ' }).success).toBe(false);
    expect(
      GoogleGmailSearchMessagesInputSchema.safeParse({ query: 'from:me', body: 'send' }).success,
    ).toBe(false);
  });

  it('bounds Google Tasks results', () => {
    expect(GoogleTasksListInputSchema.parse({})).toEqual({ limit: 10 });
    expect(GoogleTasksListInputSchema.safeParse({ limit: 51 }).success).toBe(false);
  });

  it('registers provider tools as owner-only, read-only capabilities', () => {
    registerBuiltInTools();

    for (const name of [
      'google_calendar_list_events',
      'google_gmail_search_messages',
      'google_tasks_list',
    ]) {
      const tool = toolRegistry.get(name);
      expect(tool.riskLevel).toBe(ToolRiskLevel.READ_ONLY);
      expect(tool.sideEffecting).toBe(false);
      expect(tool.allowPublicVisitor).toBe(false);
    }

    expect(toolRegistry.listDefinitionsForModel().map((definition) => definition.name)).toEqual(
      expect.arrayContaining([
        'google_calendar_list_events',
        'google_gmail_search_messages',
        'google_tasks_list',
      ]),
    );
  });
});
