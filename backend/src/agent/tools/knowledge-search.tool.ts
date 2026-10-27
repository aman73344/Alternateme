/**
 * KnowledgeSearchTool
 *
 * A thin wrapper over the Phase 4 `ragService`. It deliberately does NOT
 * re-implement embedding, vector search, reranking or citation assembly —
 * that is exactly the duplication Phase 6 must avoid.
 */

import { ragService } from '@/rag/rag.service';
import { AGENT_TOOL_NAMES } from '../agent.constants';
import { ToolRiskLevel, type AgentTool, type ToolExecutionContext } from '../agent.types';
import { KnowledgeSearchInputSchema } from './tool.schemas';

export interface KnowledgeSearchOutput {
  hasRelevantContext: boolean;
  results: Array<{
    content: string;
    similarity: number;
    sourceTitle: string;
    sourceUrl?: string | null;
  }>;
  matchedCount: number;
}

export const knowledgeSearchTool: AgentTool<
  { query: string; limit: number; sourceId?: string },
  KnowledgeSearchOutput
> = {
  name: AGENT_TOOL_NAMES.KNOWLEDGE_SEARCH,
  description:
    "Search the Alternate's indexed knowledge base for passages relevant to a question. " +
    'Returns quoted excerpts with their source titles. Read-only.',
  inputSchema: KnowledgeSearchInputSchema,
  riskLevel: ToolRiskLevel.READ_ONLY,
  sideEffecting: false,
  // Mirrors existing chat behaviour: a visitor already receives RAG answers
  // from a public Alternate, so the same read path is safe to expose.
  allowPublicVisitor: true,

  async execute(context: ToolExecutionContext, input) {
    const result = await ragService.retrieve(
      input.query,
      context.alternateId,
      // RAG is tenant-scoped on the Alternate; a visitor run is still confined
      // to the alternate they are talking to.
      context.userId ?? context.alternateId,
      input.sourceId ? { sourceId: input.sourceId } : undefined,
    );

    const top = result.chunks.slice(0, input.limit);
    return {
      hasRelevantContext: result.hasRelevantContext,
      matchedCount: result.finalCount,
      results: top.map((chunk) => {
        const citation = result.citations.find((c) => c.chunkId === chunk.id);
        return {
          content: chunk.content.slice(0, 1500),
          similarity: chunk.rerankScore ?? chunk.similarity,
          sourceTitle: citation?.title ?? 'Unknown source',
          sourceUrl: citation?.url ?? null,
        };
      }),
    };
  },
};
