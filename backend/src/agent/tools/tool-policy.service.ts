/**
 * Tool Policy Service
 *
 * Central, deny-by-default policy. Business rules live here — never inside an
 * individual tool. Pure functions only, so the policy is unit-testable without
 * a database.
 */

import { config } from '@/config';
import { DEFAULT_APPROVAL_REQUIRED } from '../agent.constants';
import { AgentExecutionContext, type AgentLimits, ToolRiskLevel } from '../agent.types';
import type { ToolConfigurationRecord } from '../agent.types';
import type { RegisteredTool } from './tool.registry';

export interface PolicyDecision {
  allowed: boolean;
  requiresApproval: boolean;
  /** Machine-readable reason, safe for logs/audit (never model-facing text). */
  reason: string;
  /** Set when the decision denies the call. */
  denyCode?: 'TOOL_NOT_ALLOWED' | 'TOOL_DISABLED';
}

/** Resolve the effective limits from configuration. */
export function resolveLimits(): AgentLimits {
  const l = config.agent.limits;
  return {
    maxSteps: l.maxSteps,
    maxToolCalls: l.maxToolCalls,
    maxRuntimeMs: l.maxRuntimeMs,
    maxToolRuntimeMs: l.maxToolRuntimeMs,
    maxContextTokens: l.maxContextTokens,
    maxToolResultChars: l.maxToolResultChars,
    maxLlmCalls: l.maxLlmCalls,
    maxToolCallsPerTool: l.maxToolCallsPerTool,
  };
}

/**
 * Does this risk level require human approval?
 * Precedence: per-Alternate override → config → deny-by-default default.
 */
export function requiresApproval(riskLevel: ToolRiskLevel, override?: boolean | null): boolean {
  if (typeof override === 'boolean') return override;
  const configured = config.agent.approval.requireByRiskLevel[riskLevel];
  if (typeof configured === 'boolean') return configured;
  // Unknown/renamed risk level: fail closed.
  return DEFAULT_APPROVAL_REQUIRED[riskLevel] ?? true;
}

/**
 * May this execution context reach this tool at all?
 *
 * The critical rule: a PUBLIC_VISITOR never inherits the owner's permissions.
 * A visitor can only reach tools that explicitly opt in via
 * `allowPublicVisitor` AND are permitted by the per-Alternate configuration.
 */
export function isContextPermitted(
  tool: RegisteredTool,
  executionContext: AgentExecutionContext,
  perAlternate?: ToolConfigurationRecord | null,
): { allowed: boolean; reason: string } {
  if (executionContext === AgentExecutionContext.PUBLIC_VISITOR) {
    if (!tool.allowPublicVisitor) {
      return { allowed: false, reason: 'PUBLIC_VISITOR_NOT_PERMITTED' };
    }
    if (
      perAlternate?.allowedContexts &&
      !perAlternate.allowedContexts.includes(AgentExecutionContext.PUBLIC_VISITOR)
    ) {
      return { allowed: false, reason: 'PUBLIC_VISITOR_REVOKED_FOR_ALTERNATE' };
    }
    // Visitors can never trigger an approval flow: there is no owner present
    // to approve, so requiring approval is equivalent to denying.
    if (requiresApproval(tool.riskLevel, perAlternate?.requireApproval)) {
      return { allowed: false, reason: 'APPROVAL_REQUIRED_BUT_NO_OWNER_PRESENT' };
    }
    return { allowed: true, reason: 'PUBLIC_VISITOR_READ_ONLY_ALLOWED' };
  }

  if (perAlternate?.allowedContexts && !perAlternate.allowedContexts.includes(executionContext)) {
    return { allowed: false, reason: 'CONTEXT_NOT_ALLOWED_FOR_ALTERNATE' };
  }

  return { allowed: true, reason: 'CONTEXT_ALLOWED' };
}

/**
 * Full pre-execution policy for one tool call.
 * `toolCallCountForTool` is the number of times this tool was already called in
 * the current run, used to enforce the per-tool budget.
 */
export function evaluateToolPolicy(params: {
  tool: RegisteredTool;
  executionContext: AgentExecutionContext;
  perAlternate?: ToolConfigurationRecord | null;
  toolCallCountForTool: number;
  toolCallCountTotal: number;
  limits: AgentLimits;
}): PolicyDecision {
  const { tool, executionContext, perAlternate, toolCallCountForTool, toolCallCountTotal, limits } =
    params;

  if (perAlternate && !perAlternate.isEnabled) {
    return {
      allowed: false,
      requiresApproval: false,
      reason: 'DISABLED_FOR_ALTERNATE',
      denyCode: 'TOOL_DISABLED',
    };
  }

  const context = isContextPermitted(tool, executionContext, perAlternate);
  if (!context.allowed) {
    return {
      allowed: false,
      requiresApproval: false,
      reason: context.reason,
      denyCode: 'TOOL_NOT_ALLOWED',
    };
  }

  if (toolCallCountTotal >= limits.maxToolCalls) {
    return { allowed: false, requiresApproval: false, reason: 'RUN_TOOL_CALL_BUDGET_EXHAUSTED' };
  }

  const perToolLimit = perAlternate?.maxCallsPerRun ?? limits.maxToolCallsPerTool;
  if (toolCallCountForTool >= perToolLimit) {
    return { allowed: false, requiresApproval: false, reason: 'PER_TOOL_BUDGET_EXHAUSTED' };
  }

  const approval = requiresApproval(tool.riskLevel, perAlternate?.requireApproval);
  return {
    allowed: true,
    requiresApproval: approval,
    reason: approval ? 'APPROVAL_REQUIRED_BY_RISK_LEVEL' : 'NO_APPROVAL_REQUIRED',
  };
}

export const toolPolicy = {
  resolveLimits,
  requiresApproval,
  isContextPermitted,
  evaluateToolPolicy,
};
