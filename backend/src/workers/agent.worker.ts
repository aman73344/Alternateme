/**
 * Agent Worker
 *
 * Consumes long-running agent runs from the `agent` queue. The worker stays
 * thin — all orchestration lives in AgentOrchestrator. Inline execution remains
 * the default for simple read-only tools; this queue is used when a run is
 * explicitly asynchronous, needs an approval wait, or exceeds a latency budget.
 *
 * Failed jobs are NOT retried for terminal agent errors (max steps, denial,
 * policy, invalid input) — BullMQ only retries what the agent classifies as
 * transient, avoiding budget burn on denials.
 */

import { Worker, Job } from 'bullmq';
import { config } from '@/config';
import { logger } from '@/utils/logger';
import { QueueName } from '@/queues';
import { AgentError } from '@/agent/agent.errors';
import { agentOrchestrator } from '@/agent/orchestration/orchestrator.service';

export interface AgentJobData {
  alternateId: string;
  userId: string;
  goal: string;
  conversationId?: string;
  requestId?: string;
}

const connection = {
  url: config.redis.url,
  maxRetriesPerRequest: null,
};

export function createAgentWorker(): Worker {
  const worker = new Worker(
    QueueName.AGENT,
    async (job: Job<AgentJobData>) => {
      const data = job.data;
      const started = Date.now();

      logger.info(
        { jobId: job.id, alternateId: data.alternateId, runContext: 'agent' },
        'agent_run_started',
      );

      try {
        const result = await agentOrchestrator.run({
          alternateId: data.alternateId,
          userId: data.userId,
          goal: data.goal,
          conversationId: data.conversationId,
          requestId: data.requestId,
        });

        logger.info(
          {
            jobId: job.id,
            runId: result.runId,
            status: result.status,
            stepCount: result.stepCount,
            toolCallCount: result.toolCallCount,
            durationMs: Date.now() - started,
          },
          'agent_run_completed',
        );
        return result;
      } catch (err) {
        const code = err instanceof AgentError ? err.code : 'AGENT_EXECUTION_FAILED';
        const retryable = AgentError.isRetryableError(err);
        logger.error(
          {
            jobId: job.id,
            errorCode: code,
            retryable,
            durationMs: Date.now() - started,
            err: err instanceof Error ? { message: err.message } : err,
          },
          'agent_run_failed',
        );
        // Terminal errors are dropped immediately instead of consuming attempts.
        if (!retryable) {
          throw new UnrecoverableAgentJobError(code);
        }
        throw err;
      }
    },
    { connection, concurrency: config.queue.concurrency },
  );

  worker.on('completed', (job) => {
    logger.info({ jobId: job.id }, 'Agent worker completed');
  });

  worker.on('failed', (job, err) => {
    logger.error(
      { jobId: job?.id, err: err instanceof Error ? err.message : err },
      'Agent worker failed',
    );
  });

  return worker;
}

/** Marks a job as non-retryable for BullMQ. */
class UnrecoverableAgentJobError extends Error {
  readonly code: string;
  constructor(code: string) {
    super(`Agent run failed permanently: ${code}`);
    this.name = 'UnrecoverableAgentJobError';
    this.code = code;
  }
}
