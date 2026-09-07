# Phase 4 — RAG, Retrieval & AI Response Engine

## Implementation Complete

### 1. Architecture

The Phase 4 implementation follows a layered RAG architecture:

```
              USER MESSAGE
                   │
                   ▼
            Authentication
                   │
                   ▼
            Alternate Context
                   │
                   ▼
             Query Analysis & Normalization
                   │
                   ▼
            Query Embedding
                   │
                   ▼
         PostgreSQL + pgvector
                   │
                   ▼
          Candidate Retrieval
                   │
                   ▼
         Metadata Filtering
                   │
                   ▼
              Reranking
                   │
                   ▼
           Context Assembly
                   │
         ┌─────────┼──────────┐
         ▼         ▼          ▼
      Persona   Knowledge   Conversation
         │         │          │
         └─────────┼──────────┘
                   ▼
              Prompt Builder
                   │
                   ▼
                LLM
                   │
                   ▼
              AI Response
                   │
                   ▼
          Sources / Citations
                   │
                   ▼
             Conversation
                   │
                   ▼
                User
```

### 2. Retrieval

**Embedding**: Uses the existing `EmbeddingService` with configurable provider (OpenAI by default). Query embeddings are generated with the same dimensions as stored vectors (1536 for OpenAI).

**Vector Search**: PostgreSQL + pgvector with cosine similarity. The `VectorRepository.searchSimilar()` method performs parameterized SQL queries with multi-tenant filtering:
- `alternateId` = authenticated user's alternate
- `userId` = authenticated user
- `version` = current knowledge version
- `isActive` = true for chunks
- `status != DELETED` for sources and documents

**Filtering**: Supports filtering by alternateId, userId, knowledgeVersion, sourceId, documentId, sourceType, language.

**Reranking**: `LocalReranker` with scoring strategy:
- Base score from vector similarity
- Boost for heading matches (+0.1)
- Boost for content relevance (+0.05)
- Penalty for very short chunks (-0.1)

**Context Selection**: Configurable via environment variables:
- `RAG_INITIAL_TOP_K=20` (candidates retrieved)
- `RAG_FINAL_TOP_K=5` (final chunks in context)
- `RAG_MIN_SIMILARITY=0.7` (minimum threshold)

### 3. LLM

**Provider Architecture**: Abstracted behind `LLMProvider` interface:
- `OpenAIProvider` — GPT-4o, GPT-4, GPT-3.5
- `AnthropicProvider` — Claude 3/4

**Configuration**: Per-alternate provider configuration stored in `AIProviderConfig` with AES-256-GCM encrypted API keys.

### 4. Persona

Persona influences HOW the Alternate communicates:
- Tone, Writing Style, Personality
- Instructions, Boundaries, Refusal Behavior

The `PromptBuilder` integrates persona into the system prompt while keeping it separate from knowledge context.

### 5. Conversation

**Storage**: Uses existing `Conversation` and `Message` models with sources JSON for citations.

**Context Handling**: Recent conversation history included with configurable limits.

### 6. Citations

Every retrieved chunk retains provenance: Source ID, Document ID, Chunk ID, Title, URL, Page, Relevance score.

### 7. Security

- All endpoints require authentication
- `requireAlternateOwnership` middleware validates ownership
- Prompt injection defense in system prompt
- API keys encrypted with AES-256-GCM
- Rate limiting on chat endpoint
- Parameterized SQL queries prevent injection

### 8. API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/alternates/:alternateId/chat` | Send a chat message |
| GET | `/alternates/:alternateId/conversations` | List conversations |
| GET | `/alternates/:alternateId/conversations/:conversationId` | Get conversation |
| DELETE | `/alternates/:alternateId/conversations/:conversationId` | Delete conversation |
| POST | `/alternates/:alternateId/rag/debug` | Debug RAG (dev only) |

### 9. Files Created

**RAG Module** (`src/rag/`):
- `types.ts`, `vector.repository.ts`, `reranker.ts`
- `context-builder.ts`, `prompt-builder.ts`
- `llm-provider.ts`, `rag.service.ts`, `index.ts`

**Chat Module** (`src/chat/`):
- `conversation.service.ts`, `chat.service.ts`
- `chat.controller.ts`, `chat.routes.ts`, `index.ts`

**Tests** (`src/tests/`):
- `rag.service.test.ts`, `chat.service.test.ts`, `chat.security.test.ts`

### 10. Known Limitations

1. Hybrid search (keyword + semantic) not yet implemented
2. External rerankers (Cohere/Voyage) not yet integrated
3. Streaming responses not implemented
4. Long-term memory system not implemented
5. Voice/Email/Phone channels not in this phase

### 11. Phase 5 Readiness

Phase 4 provides the foundation for:
- Voice Generation (LLM responses → speech)
- Email Automation (chat flow adapted for email)
- Phone Calls (telephony integration)
- Autonomous Agents (RAG + tool execution)
- Advanced Memory (conversation storage enables long-term memory)
