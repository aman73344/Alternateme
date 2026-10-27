import { AgentError } from '../agent.errors';
import { AGENT_TOOL_NAMES } from '../agent.constants';
import { ToolRiskLevel, type AgentTool, type ToolExecutionContext } from '../agent.types';
import { integrationService } from '@/integrations/integration.service';
import type {
  GoogleCalendarListInput,
  GoogleGmailSearchInput,
  GoogleTasksListInput,
} from '@/integrations/types';
import {
  GoogleCalendarListEventsInputSchema,
  GoogleGmailSearchMessagesInputSchema,
  GoogleTasksListInputSchema,
} from './tool.schemas';

function assertIntegrationOwner(
  context: ToolExecutionContext,
): asserts context is ToolExecutionContext & { userId: string } {
  if (!context.userId || !context.isOwner) {
    throw AgentError.from('TOOL_NOT_ALLOWED', { reason: 'INTEGRATION_REQUIRES_OWNER' });
  }
}

export const googleCalendarListEventsTool: AgentTool<GoogleCalendarListInput, unknown> = {
  name: AGENT_TOOL_NAMES.GOOGLE_CALENDAR_LIST_EVENTS,
  description: 'Read upcoming events from the Google Calendar connected to this Alternate.',
  inputSchema: GoogleCalendarListEventsInputSchema,
  riskLevel: ToolRiskLevel.READ_ONLY,
  sideEffecting: false,
  allowPublicVisitor: false,
  async execute(context, input) {
    assertIntegrationOwner(context);
    return integrationService.executeCapability(
      context.userId,
      context.alternateId,
      'google_calendar_list_events',
      input,
      context.agentRunId,
    );
  },
};

export const googleGmailSearchMessagesTool: AgentTool<GoogleGmailSearchInput, unknown> = {
  name: AGENT_TOOL_NAMES.GOOGLE_GMAIL_SEARCH_MESSAGES,
  description:
    'Search message headers and snippets in the owner-connected Gmail account. Read-only.',
  inputSchema: GoogleGmailSearchMessagesInputSchema,
  riskLevel: ToolRiskLevel.READ_ONLY,
  sideEffecting: false,
  allowPublicVisitor: false,
  async execute(context, input) {
    assertIntegrationOwner(context);
    return integrationService.executeCapability(
      context.userId,
      context.alternateId,
      'google_gmail_search_messages',
      input,
      context.agentRunId,
    );
  },
};

export const googleTasksListTool: AgentTool<GoogleTasksListInput, unknown> = {
  name: AGENT_TOOL_NAMES.GOOGLE_TASKS_LIST,
  description: 'Read tasks from the first Google Tasks list in the owner-connected account.',
  inputSchema: GoogleTasksListInputSchema,
  riskLevel: ToolRiskLevel.READ_ONLY,
  sideEffecting: false,
  allowPublicVisitor: false,
  async execute(context, input) {
    assertIntegrationOwner(context);
    return integrationService.executeCapability(
      context.userId,
      context.alternateId,
      'google_tasks_list',
      input,
      context.agentRunId,
    );
  },
};
