/**
 * RAG (Retrieval-Augmented Generation) type definitions.
 *
 * These types define the data structures used throughout the RAG pipeline:
 * query analysis, embedding, retrieval, reranking, and context assembly.
 */

/** A single retrieved chunk with its source metadata and relevance score */
export interface RetrievedChunk {
  id: string;
  content: string;
  chunkIndex: number;
  documentId: string;
  sourceId: string;
  alternateId: string;
  version: number;
  heading?: string | null;
  metadata?: Record<string, unknown> | null;
  similarity: number;
  rerankScore?: number;
}

/** Source citation for a retrieved chunk */
export interface SourceCitation {
  sourceId: string;
  documentId: string;
  title: string;
  url?: string;
  page?: number;
  chunkId: string;
  relevance: number;
}

/** Result of the RAG retrieval pipeline */
export interface RetrievalResult {
  chunks: RetrievedChunk[];
  citations: SourceCitation[];
  hasRelevantContext: boolean;
  candidateCount: number;
  finalCount: number;
  query: string;
  normalizedQuery: string;
  latencyMs: number;
}

/** Parameters for vector search */
export interface VectorSearchParams {
  alternateId: string;
  userId: string;
  queryEmbedding: number[];
  topK: number;
  minSimilarity: number;
  knowledgeVersion?: number;
  sourceId?: string;
  documentId?: string;
  sourceType?: string;
  language?: string;
}

/** RAG configuration options */
export interface RagConfig {
  initialTopK: number;
  finalTopK: number;
  minSimilarity: number;
  maxContextTokens: number;
  maxChunks: number;
  maxCharacters: number;
  embeddingDimensions: number;
}

/** Context assembled for the LLM */
export interface AssembledContext {
  systemPrompt: string;
  knowledgeContext: string;
  conversationContext: string;
  personaContext: string;
  retrievedChunks: RetrievedChunk[];
  citations: SourceCitation[];
  tokenEstimate: number;
}

/** Chat message roles */
export type ChatRole = 'SYSTEM' | 'USER' | 'ASSISTANT';

/** Chat message structure */
export interface ChatMessage {
  role: ChatRole;
  content: string;
}

/** Chat request payload */
export interface ChatRequest {
  conversationId?: string;
  message: string;
}

/** Chat response payload */
export interface ChatResponse {
  conversationId: string;
  message: {
    id: string;
    role: 'ASSISTANT';
    content: string;
    createdAt: Date;
  };
  sources: Array<{
    title: string;
    url?: string;
    page?: number;
  }>;
}

/** A tool the model may call, in provider-neutral form (Phase 6). */
export interface LLMToolDefinition {
  /** Tool name as exposed to the model (no internal implementation details). */
  name: string;
  description: string;
  /** JSON Schema describing the tool arguments. */
  parameters: Record<string, unknown>;
}

/** A structured tool call requested by the model. */
export interface LLMToolCall {
  /** Provider call id, echoed back on the tool result message when required. */
  id: string;
  name: string;
  /** Raw arguments exactly as returned by the provider (untrusted — must be validated). */
  arguments: unknown;
}

/** LLM provider interface for chat completions */
export interface LLMChatRequest {
  messages: ChatMessage[];
  model: string;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
  /** Optional tool catalogue. Omitting it keeps behaviour identical to Phase 4. */
  tools?: LLMToolDefinition[];
  /** When true the provider is nudged to prefer an answer over a tool call. */
  toolChoice?: 'auto' | 'none';
  /** Structured tool results to append to the conversation (Phase 6 agent loop). */
  toolResults?: Array<{ toolCallId: string; name: string; content: string }>;
}

export interface LLMChatResponse {
  content: string;
  tokensUsed?: number;
  model: string;
  finishReason?: string;
  /** Present when the model requested one or more tools. */
  toolCalls?: LLMToolCall[];
}

export interface LLMProvider {
  readonly name: string;
  generateChatCompletion(request: LLMChatRequest): Promise<LLMChatResponse>;
  getModelInfo(): { name: string; maxTokens: number };
  healthCheck(): Promise<boolean>;
}

/** Debug information for RAG pipeline */
export interface RagDebugInfo {
  query: string;
  normalizedQuery: string;
  candidateCount: number;
  retrievedChunks: Array<{
    id: string;
    content: string;
    similarity: number;
    rerankScore?: number;
    sourceId: string;
    documentId: string;
  }>;
  scores: {
    similarity: number[];
    rerank?: number[];
  };
  sources: SourceCitation[];
  finalContext: string;
  latencyMs: number;
}
