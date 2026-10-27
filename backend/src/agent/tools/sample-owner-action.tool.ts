/**
 * SampleOwnerActionTool — approval-gate scaffolding
 *
 * NOT a product feature. Phase 6 must not ship real email/SMS/CRM/calendar
 * integrations, but the approval gate still needs a tool to prove itself
 * against. This tool is HIGH risk, owner-only, performs no external side
 * effect, and simply returns a confirmation payload that the agent loop records
 * on the ToolExecution row.
 *
 * It is only registered when AGENT_SAMPLE_ACTION_TOOL_ENABLED=true, and it is
 * intentionally idempotent: the same (alternate, note) pair is executed once.
 */

import { AGENT_TOOL_NAMES } from '../agent.constants';
import { AgentError } from '../agent.errors';
import {
  AgentExecutionContext,
  ToolRiskLevel,
  type AgentTool,
  type ToolExecutionContext,
} from '../agent.types';
import { SampleOwnerActionInputSchema } from './tool.schemas';

export interface SampleOwnerActionOutput {
  acknowledged: boolean;
  note: string;
  urgency: string;
  recordedAt: string;
}

export const sampleOwnerActionTool: AgentTool<
  { note: string; urgency: 'low' | 'normal' | 'high' },
  SampleOwnerActionOutput
> = {
  name: AGENT_TOOL_NAMES.SAMPLE_OWNER_ACTION,
  description:
    'Record an owner-approved action on behalf of the owner. This action requires ' +
    'explicit owner approval before it runs. Use only when the owner asks for it.',
  inputSchema: SampleOwnerActionInputSchema,
  riskLevel: ToolRiskLevel.HIGH,
  sideEffecting: true,
  allowPublicVisitor: false,

  async execute(context: ToolExecutionContext, input) {
    if (context.executionContext === AgentExecutionContext.PUBLIC_VISITOR) {
      throw AgentError.from('TOOL_NOT_ALLOWED', { tool: this.name, reason: 'OWNER_ONLY_TOOL' });
    }
    if (!context.isOwner) {
      throw AgentError.from('TOOL_NOT_ALLOWED', { tool: this.name, reason: 'REQUIRES_OWNER' });
    }

    return {
      acknowledged: true,
      note: input.note,
      urgency: input.urgency,
      recordedAt: new Date().toISOString(),
    };
  },
};
