/**
 * Memory Ranker
 *
 * Ranks retrieved memories using multiple signals:
 * - Semantic similarity
 * - Importance
 * - Confidence
 * - Recency (lastReinforcedAt, createdAt)
 * - Reinforcement count
 *
 * Formula:
 *   Final Score = similarity × relevance_weight + importance × imp_weight
 *     + confidence × conf_weight + recency × rec_weight
 *     + reinforcement × rein_weight
 */

import { Memory } from './memory.types';
import { MEMORY_DEFAULTS } from './memory.constants';

export interface RankedMemory {
  memory: Memory;
  score: number;
  similarity?: number;
  importanceScore: number;
  confidenceScore: number;
  recencyScore: number;
  reinforcementScore: number;
}

export interface MemoryRankParams {
  topK?: number;
  maxTokens?: number;
  minScore?: number;
}

const DEFAULT_PARAMS: Required<MemoryRankParams> = {
  topK: MEMORY_DEFAULTS.TOP_K,
  maxTokens: MEMORY_DEFAULTS.MAX_TOKENS,
  minScore: MEMORY_DEFAULTS.MIN_SCORE,
};

/**
 * Estimate token count from content (approximate).
 */
export function estimateTokens(content: string): number {
  return Math.ceil((content?.length ?? 0) / 4);
}

/**
 * Calculate recency score (0-1) based on lastReinforcedAt.
 * More recent = higher score.
 */
function calculateRecencyScore(memory: Memory): number {
  const now = Date.now();
  const lastReinforced = new Date(memory.lastReinforcedAt).getTime();
  const daysSince = (now - lastReinforced) / (1000 * 60 * 60 * 24);

  // Decay: 0 days = 1.0, 7 days = 0.5, 30 days = 0.1
  if (daysSince < 1) return 1.0;
  if (daysSince < 7) return 1.0 - (daysSince / 7) * 0.5;
  if (daysSince < 30) return 0.5 - ((daysSince - 7) / 23) * 0.4;
  return 0.1;
}

/**
 * Calculate reinforcement score (0-1) based on reinforcement count.
 */
function calculateReinforcementScore(memory: Memory): number {
  const count = memory.reinforcementCount ?? 0;
  // Caps at 1.0 around 10 reinforcements
  return Math.min(count / 10, 1.0);
}

/**
 * Rank memories using weighted scoring.
 */
export function rankMemories(
  memories: Array<Memory & { similarity?: number }>,
  params: MemoryRankParams = {},
): RankedMemory[] {
  const opts = { ...DEFAULT_PARAMS, ...params };
  const weights = {
    relevance: 0.4,
    importance: MEMORY_DEFAULTS.RERANK_IMPORTANCE_WEIGHT + 0.25,
    confidence: MEMORY_DEFAULTS.RERANK_CONFIDENCE_WEIGHT + 0.25,
    recency: MEMORY_DEFAULTS.RERANK_RECENCY_WEIGHT + 0.1,
    reinforcement: MEMORY_DEFAULTS.RERANK_REINFORCEMENT_WEIGHT + 0.1,
  };

  // Normalize weights to sum to 1.0
  const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);
  const normalizedWeights = Object.fromEntries(
    Object.entries(weights).map(([k, v]) => [k, v / totalWeight]),
  );

  const ranked = memories.map((m) => {
    const similarity = m.similarity ?? 0;
    const importanceScore = m.importance;
    const confidenceScore = m.confidence;
    const recencyScore = calculateRecencyScore(m);
    const reinforcementScore = calculateReinforcementScore(m);

    const finalScore =
      similarity * normalizedWeights.relevance +
      importanceScore * normalizedWeights.importance +
      confidenceScore * normalizedWeights.confidence +
      recencyScore * normalizedWeights.recency +
      reinforcementScore * normalizedWeights.reinforcement;

    return {
      memory: m,
      score: finalScore,
      similarity,
      importanceScore,
      confidenceScore,
      recencyScore,
      reinforcementScore,
    };
  });

  // Sort by score descending
  ranked.sort((a, b) => b.score - a.score);

  // Filter by min score
  let filtered = ranked.filter((r) => r.score >= (opts.minScore ?? 0));

  // Apply token budget
  let tokenBudget = opts.maxTokens;
  const selected: RankedMemory[] = [];
  for (const r of filtered) {
    const tokens = estimateTokens(r.memory.content);
    if (tokens > tokenBudget) continue;
    selected.push(r);
    tokenBudget -= tokens;
    if (selected.length >= opts.topK) break;
  }

  return selected;
}
