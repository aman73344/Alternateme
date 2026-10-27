/**
 * Agent Module — public surface (Phase 6)
 */

export { agentService, AgentService } from './agent.service';
export { agentOrchestrator, AgentOrchestrator } from './orchestration/orchestrator.service';
export { agentRouter } from './agent.routes';
export { AgentError, AGENT_ERRORS } from './agent.errors';
export {
  AgentExecutionContext,
  AgentRunStatus,
  AgentStepStatus,
  AgentStepType,
  ApprovalStatus,
  ToolExecutionStatus,
  ToolRiskLevel,
  type AgentLimits,
  type AgentTool,
  type ToolConfigurationRecord,
  type ToolExecutionContext,
  type SanitizedToolResult,
} from './agent.types';
export { AGENT_TOOL_NAMES } from './agent.constants';
export { registerBuiltInTools, toolRegistry, resetToolRegistration, toJsonSchema } from './tools';
export {
  authorizeToolCall,
  assertCanStartRun,
  deriveExecutionContext,
} from './tools/authorization.service';
export {
  evaluateToolPolicy,
  isContextPermitted,
  requiresApproval,
  resolveLimits,
} from './tools/tool-policy.service';
export {
  neutraliseInjection,
  sanitizeToolResult,
  sanitizeValue,
  sanitizeToolInput,
} from './tools/tool-sanitizer';
export { executeToolCall, executeApprovedCall } from './execution/execution.service';
export { deriveIdempotencyKey, canonicalize } from './execution/idempotency.service';
export { isRetryable, backoffMs, withRetry } from './execution/retry-policy';
export { auditAgentEvent } from './agent.audit';
