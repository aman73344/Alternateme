/**
 * Shared types for the knowledge ingestion pipeline. These are pure data
 * contracts between the stages: extractor → cleaner → chunker → embedding →
 * repository. Kept free of database/queue imports so every stage can be unit
 * tested in isolation.
 */

export interface ExtractionResult {
  title: string;
  content: string; // raw extracted text (pre-cleaning)
  mimeType?: string;
  language?: string;
  pageCount?: number;
  sourceUrl?: string;
  ocrRequired?: boolean;
  metadata?: Record<string, unknown>;
}

export interface CleanedContent {
  content: string; // normalized text (post-cleaning)
  language?: string;
  metadata?: Record<string, unknown>;
}

export interface Chunk {
  content: string;
  index: number;
  heading?: string;
  tokenCount: number;
  characterCount: number;
  metadata?: Record<string, unknown>;
}

export interface EmbeddingVector {
  vector: number[];
  model: string;
  dimensions: number;
  tokenCount?: number;
}

// Stage labels + a measurable "progress hint". Progress is never faked: for
// per-byte pipelines we report real percentages, otherwise we expose the stage
// label and a stable approximate anchor requested by the spec.
export const INGESTION_STAGES = [
  'QUEUED',
  'PROCESSING',
  'EXTRACTING',
  'CLEANING',
  'CHUNKING',
  'EMBEDDING',
  'COMPLETED',
] as const;

export type IngestionStageName = (typeof INGESTION_STAGES)[number];

export const STAGE_ANCHOR: Record<IngestionStageName, number> = {
  QUEUED: 0,
  PROCESSING: 5,
  EXTRACTING: 25,
  CLEANING: 45,
  CHUNKING: 60,
  EMBEDDING: 70,
  COMPLETED: 100,
};

export interface IngestionJobData {
  jobId: string;
  userId: string;
  alternateId: string;
  sourceId: string;
  version?: number;
  force?: boolean;
}