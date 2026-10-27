/**
 * Built-in Tool Registration
 *
 * Registers the Phase 6 tool catalogue. The sample action tool is opt-in via
 * configuration so a default deployment exposes only read-only capabilities.
 */

import { config } from '@/config';
import { logger } from '@/utils/logger';
import { toolRegistry } from './tool.registry';
import { knowledgeSearchTool } from './knowledge-search.tool';
import { memorySearchTool } from './memory-search.tool';
import { conversationContextTool } from './conversation-context.tool';
import { alternateContextTool } from './alternate-context.tool';
import { sampleOwnerActionTool } from './sample-owner-action.tool';
import {
  googleCalendarListEventsTool,
  googleGmailSearchMessagesTool,
  googleTasksListTool,
} from './google-integration.tools';

let registered = false;

/** Idempotent: safe to call from both the API boot path and the worker. */
export function registerBuiltInTools(): void {
  if (registered) return;

  toolRegistry.register(knowledgeSearchTool);
  toolRegistry.register(memorySearchTool);
  toolRegistry.register(conversationContextTool);
  toolRegistry.register(alternateContextTool);
  toolRegistry.register(googleCalendarListEventsTool);
  toolRegistry.register(googleGmailSearchMessagesTool);
  toolRegistry.register(googleTasksListTool);

  if (config.agent.sampleActionToolEnabled) {
    toolRegistry.register(sampleOwnerActionTool);
  }

  registered = true;
  logger.info({ tools: toolRegistry.list().map((t) => t.name) }, 'agent.tools.registered');
}

/** Test helper — allows a clean registry between cases. */
export function resetToolRegistration(): void {
  toolRegistry.clear();
  registered = false;
}

export { toolRegistry, toJsonSchema } from './tool.registry';
export type { RegisteredTool, ToolDefinitionForModel } from './tool.registry';
