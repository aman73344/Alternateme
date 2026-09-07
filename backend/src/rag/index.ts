/**
 * RAG Module — Retrieval-Augmented Generation pipeline.
 * 
 * Exports all RAG components for use by the chat system and other modules.
 */

export { ragService, RagService } from './rag.service';
export { vectorRepository, VectorRepository } from './vector.repository';
export { reranker, LocalReranker, IdentityReranker } from './reranker';
export type { Reranker } from './reranker';
export { contextBuilder, ContextBuilder } from './context-builder';
export { promptBuilder, PromptBuilder } from './prompt-builder';
export { OpenAIProvider, AnthropicProvider, createLLMProvider } from './llm-provider';
export * from './types';
