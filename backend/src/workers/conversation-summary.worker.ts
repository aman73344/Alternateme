/**
 * Conversation Summary Worker
 *
 * Summarizes long conversations when they exceed the token threshold,
 * preventing unbounded context growth.
 */

import { Worker, Job } from 'bullmq';
import { config } from '@/config';
import { logger } from '@/utils/logger';
import { QueueName } from '@/queues';
import { prisma } from '@/database';
import { createLLMProvider } from '@/rag/llm-provider';
import { upsertConversationSummary } from '@/memory/conversation-summary.repository';
import { estimateTokens } from '@/memory/memory.ranker';
import { MESSAGE_SUMMARY_PROMPT } from '@/memory/memory.constants';

interface SummaryJobData {
  conversationId: string;
  alternateId: string;
  userId: string;
  messageRangeStart: number;
  messageRangeEnd: number;
}

const connection = {
  url: config.redis.url,
  maxRetriesPerRequest: null,
};

export function createConversationSummaryWorker(): Worker {
  const worker = new Worker(
    QueueName.MEMORY_CONVERSATION_SUMMARY,
    async (job: Job) => {
      const data = job.data as SummaryJobData;
      const started = Date.now();

      logger.info({ jobId: job.id, conversationId: data.conversationId }, 'Conversation summary job started');

      try {
        // Load messages in range
        const messages = await prisma.message.findMany({
          where: {
            conversation: {
              id: data.conversationId,
              alternateId: data.alternateId,
              userId: data.userId,
            },
          },
          orderBy: { createdAt: 'asc' },
          skip: data.messageRangeStart,
          take: data.messageRangeEnd - data.messageRangeStart,
        });

        const content = messages
          .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
          .join('\n\n');

        // Resolve the alternate's configured provider (fallback: platform default)
        const providerConfig = await prisma.aIProviderConfig.findFirst({
          where: { alternateId: data.alternateId },
          select: { provider: true, defaultModel: true },
        });
        const providerName = (providerConfig?.provider ?? 'OPENAI') as 'OPENAI' | 'ANTHROPIC';

        const llm = createLLMProvider(providerName);
        const result = await llm.generateChatCompletion({
          messages: [
            { role: 'SYSTEM', content: MESSAGE_SUMMARY_PROMPT },
            { role: 'USER', content: `Summarize this conversation segment:\n\n${content}` },
          ],
          model: providerConfig?.defaultModel ?? config.memory.summarization.summaryModel,
          temperature: 0.5,
          maxTokens: 1000,
        });
        const summary = result.content;

        const tokenCount = estimateTokens(summary);

        await upsertConversationSummary(
          data.conversationId,
          data.alternateId,
          data.userId,
          summary,
          data.messageRangeStart,
          data.messageRangeEnd,
          tokenCount,
        );

        logger.info(
          { jobId: job.id, conversationId: data.conversationId, durationMs: Date.now() - started },
          'Conversation summary job completed',
        );

        return { success: true };
      } catch (err) {
        logger.error(
          { jobId: job.id, conversationId: data.conversationId, err },
          'Conversation summary job failed',
        );
        throw err;
      }
    },
    { connection, concurrency: config.queue.concurrency },
  );

  worker.on('completed', (job) => {
    logger.info({ jobId: job.id }, 'Conversation summary worker completed');
  });

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err }, 'Conversation summary worker failed');
  });

  return worker;
}
