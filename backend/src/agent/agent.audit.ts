/**
 * Agent Audit
 *
 * Reuses the existing `AuditLog` system (SECURITY: one audit system, not two).
 * `AuditLog.action` is a String column, so the Phase 6 actions below need no
 * enum migration.
 *
 * Audit failures are logged but never propagate: losing an audit row must not
 * abort a user-facing run, and must not be silently swallowed either.
 */

import { createAuditLog } from '@/auth/repositories/audit.repository';
import { logger } from '@/utils/logger';
import type { AgentAuditAction } from './agent.types';

export interface AgentAuditParams {
  userId: string;
  action: AgentAuditAction;
  /** Logical entity the action concerns, e.g. `agent_run`, `tool_execution`. */
  entity: string;
  entityId?: string;
  alternateId?: string;
  toolName?: string;
  status?: string;
  errorCode?: string;
  durationMs?: number;
  requestId?: string;
  ipAddress?: string;
  userAgent?: string;
  /** Must already be redacted — never pass raw arguments or tool output. */
  metadata?: Record<string, unknown>;
}

export async function auditAgentEvent(params: AgentAuditParams): Promise<void> {
  try {
    await createAuditLog({
      userId: params.userId,
      action: params.action,
      entity: params.entity,
      entityId: params.entityId,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      metadata: {
        ...(params.alternateId ? { alternateId: params.alternateId } : {}),
        ...(params.toolName ? { toolName: params.toolName } : {}),
        ...(params.status ? { status: params.status } : {}),
        ...(params.errorCode ? { errorCode: params.errorCode } : {}),
        ...(params.durationMs !== undefined ? { durationMs: params.durationMs } : {}),
        ...(params.requestId ? { requestId: params.requestId } : {}),
        ...(params.metadata ?? {}),
      },
    });
  } catch (err) {
    logger.error({ err, action: params.action, entity: params.entity }, 'agent.audit.write_failed');
  }
}
