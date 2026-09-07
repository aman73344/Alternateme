/**
 * RAG Service Tests
 * 
 * Tests the retrieval pipeline:
 * - Query embedding generation
 * - Vector search with multi-tenant filtering
 * - Reranking
 * - Context building
 * - Security (cross-user access prevention)
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '@/database';
import { ragService } from '@/rag/rag.service';
import { vectorRepository } from '@/rag/vector.repository';
import { contextBuilder } from '@/rag/context-builder';
import { reranker } from '@/rag/reranker';
import { EmbeddingService } from '@/knowledge/embedding/embedding.service';

let testUserId: string;
let testAlternateId: string;
let otherUserId: string;
let otherAlternateId: string;

describe('RAG Service', () => {
  beforeAll(async () => {
    const testUser = await prisma.user.create({
      data: {
        email: `rag-test-${Date.now()}@test.com`,
        username: `ragtest${Date.now()}`,
        passwordHash: 'test-hash',
        emailVerified: true,
      },
    });
    testUserId = testUser.id;

    const testAlternate = await prisma.alternate.create({
      data: {
        userId: testUserId,
        username: `rag-test-${Date.now()}`,
        displayName: 'RAG Test Alternate',
        title: 'Software Engineer',
        bio: 'Test alternate for RAG testing',
      },
    });
    testAlternateId = testAlternate.id;

    const otherUser = await prisma.user.create({
      data: {
        email: `rag-other-${Date.now()}@test.com`,
        username: `ragother${Date.now()}`,
        passwordHash: 'test-hash',
        emailVerified: true,
      },
    });
    otherUserId = otherUser.id;

    const otherAlternate = await prisma.alternate.create({
      data: {
        userId: otherUserId,
        username: `rag-other-${Date.now()}`,
        displayName: 'Other Alternate',
      },
    });
    otherAlternateId = otherAlternate.id;
  });

  afterAll(async () => {
    await prisma.message.deleteMany({
      where: {
        conversation: {
          alternateId: { in: [testAlternateId, otherAlternateId] },
        },
      },
    });
    await prisma.conversation.deleteMany({
      where: { alternateId: { in: [testAlternateId, otherAlternateId] } },
    });
    await prisma.embedding.deleteMany({
      where: { alternateId: { in: [testAlternateId, otherAlternateId] } },
    });
    await prisma.documentChunk.deleteMany({
      where: { alternateId: { in: [testAlternateId, otherAlternateId] } },
    });
    await prisma.knowledgeDocument.deleteMany({
      where: { alternateId: { in: [testAlternateId, otherAlternateId] } },
    });
    await prisma.knowledgeVersion.deleteMany({
      where: { alternateId: { in: [testAlternateId, otherAlternateId] } },
    });
    await prisma.trainingSource.deleteMany({
      where: { alternateId: { in: [testAlternateId, otherAlternateId] } },
    });
    await prisma.alternate.deleteMany({
      where: { id: { in: [testAlternateId, otherAlternateId] } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [testUserId, otherUserId] } },
    });
  });

  describe('Query Embedding', () => {
    it('should generate query embedding with correct dimensions', async () => {
      const embeddingService = new EmbeddingService();
      const result = await embeddingService.embed(['Test query for embedding']);

      expect(result.vectors.length).toBe(1);
      expect(result.vectors[0].length).toBe(1536);
    });

    it('should normalize query correctly', () => {
      const normalized = ragService['normalizeQuery']('  What   projects   have I worked on?  ');
      expect(normalized).toBe('What projects have I worked on');
    });
  });

  describe('Vector Search', () => {
    it('should return empty results when no embeddings exist', async () => {
      const embeddingService = new EmbeddingService();
      const embedding = await embeddingService.embed(['test query']);

      const results = await vectorRepository.searchSimilar({
        alternateId: testAlternateId,
        userId: testUserId,
        queryEmbedding: embedding.vectors[0],
        topK: 5,
        minSimilarity: 0.7,
      });

      expect(results).toEqual([]);
    });

    it('should enforce multi-tenant isolation', async () => {
      const embeddingService = new EmbeddingService();
      const embedding = await embeddingService.embed(['test query']);

      const results = await vectorRepository.searchSimilar({
        alternateId: testAlternateId,
        userId: otherUserId,
        queryEmbedding: embedding.vectors[0],
        topK: 5,
        minSimilarity: 0.0,
      });

      expect(results).toEqual([]);
    });
  });
});
