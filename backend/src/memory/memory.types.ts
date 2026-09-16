/**
 * Memory Type Definitions
 * 
 * Types used throughout the Memory subsystem for Phase 5.
 */

/** Memory types — what kind of information is stored */
export enum MemoryType {
  FACT = 'FACT',
  PREFERENCE = 'PREFERENCE',
  PERSONAL_CONTEXT = 'PERSONAL_CONTEXT',
  GOAL = 'GOAL',
  DECISION = 'DECISION',
  INSTRUCTION = 'INSTRUCTION',
  RELATIONSHIP = 'RELATIONSHIP',
  PROJECT_CONTEXT = 'PROJECT_CONTEXT',
  CONVERSATION_SUMMARY = 'CONVERSATION_SUMMARY',
}

/** Memory lifecycle status */
export enum MemoryStatus {
  ACTIVE = 'ACTIVE',        // Available for retrieval
  ARCHIVED = 'ARCHIVED',    // Retained for history, not retrieved
  DELETED = 'DELETED',      // Soft-deleted, not retrievable
  EXPIRED = 'EXPIRED',      // Past expiration, not retrieved
  SUPERSEDED = 'SUPERSEDED', // Replaced by newer memory
}

/** Memory visibility — who can access */
export enum MemoryVisibility {
  PRIVATE = 'PRIVATE',      // Owner only
  ALTERNATE = 'ALTERNATE',  // Owner + alternate (public chat can use)
}

/** Source type — how memory was created */
export enum MemorySourceType {
  EXPLICIT = 'EXPLICIT',   // User directly stated
  INFERRED = 'INFERRED',   // Derived from conversation
  ASSOCIATED = 'ASSOCIATED', // From related context
}

/** Memory record structure */
export interface Memory {
  id: string;
  alternateId: string;
  userId: string;
  type: MemoryType;
  content: string;
  normalizedContent: string;
  importance: number;
  confidence: number;
  sourceType: MemorySourceType;
  sourceConversationId?: string | null;
  sourceMessageId?: string | null;
  status: MemoryStatus;
  visibility: MemoryVisibility;
  isExtracted: boolean;
  expiresAt?: Date | null;
  lastAccessedAt: Date;
  lastReinforcedAt: Date;
  reinforcementCount: number;
  supersededById?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Input for creating a memory */
export interface CreateMemoryInput {
  alternateId: string;
  userId: string;
  type: MemoryType;
  content: string;
  importance: number;
  confidence: number;
  sourceType: MemorySourceType;
  sourceConversationId?: string;
  sourceMessageId?: string;
  visibility?: MemoryVisibility;
  expiresAt?: Date;
}

/** Input for updating a memory */
export interface UpdateMemoryInput {
  content?: string;
  importance?: number;
  confidence?: number;
  status?: MemoryStatus;
  visibility?: MemoryVisibility;
  expiresAt?: Date | null;
  reinforcementCount?: number;
  lastReinforcedAt?: Date;
  supersededById?: string | null;
}

/** Search parameters for memory retrieval */
export interface MemorySearchParams {
  alternateId: string;
  userId: string;
  queryEmbedding?: number[];
  queryText?: string;
  query?: string;  // Convenience alias for queryText
  types?: MemoryType[];
  statuses?: MemoryStatus[];
  limit?: number;
  minScore?: number;
  includePrivate?: boolean;
  maxTokens?: number;
}

/** Result of memory retrieval */
export interface MemoryRetrievalResult {
  memories: Memory[];
  scores: number[];
  tokenEstimate: number;
  totalCount: number;
  formattedContext?: string;
}

/** Memory extraction output from LLM */
export interface ExtractedMemory {
  type: MemoryType;
  content: string;
  importance: number;
  confidence: number;
  sourceType: MemorySourceType;
}

/** Memory extraction job data */
export interface MemoryExtractionJobData {
  conversationId: string;
  messageId: string;
  alternateId: string;
  userId: string;
  messageContent: string;
}

/** Formatted memory context for LLM prompt */
export interface MemoryContext {
  section: string;
  formatted: string;
  memoryCount: number;
  tokenEstimate: number;
}

/** Audit event for memory operations */
export type MemoryAuditAction =
  | 'MEMORY_CREATED'
  | 'MEMORY_UPDATED'
  | 'MEMORY_DELETED'
  | 'MEMORY_ARCHIVED'
  | 'MEMORY_SUPERSEDED'
  | 'MEMORY_CONFIRMED'
  | 'MEMORY_FORGOTTEN'
  | 'MEMORY_EXTRACTION_FAILED'
  | 'MEMORY_EMBEDDING_CREATED'
  | 'MEMORY_EMBEDDING_FAILED';
