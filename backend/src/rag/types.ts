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

/** LLM provider interface for chat completions */
export interface LLMChatRequest {
  messages: ChatMessage[];
  model: string;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
}

export interface LLMChatResponse {
  content: string;
  tokensUsed?: number;
  model: string;
  finishReason?: string;
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
