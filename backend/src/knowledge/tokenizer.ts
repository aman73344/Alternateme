/**
 * Lightweight token estimator used by the chunker and for the metadata of the
 * uploaded document. It is a deterministic heuristic (~4 chars per token for
 * Latin text, 1 per CJK rune) — not a byte-accurate model vocabulary count.
 * Embedding models reject inputs longer than their context window, so this is
 * "token-aware where practical" without shipping a model-specific BPE.
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  let count = 0;
  for (const ch of text) {
    const code = ch.codePointAt(0)!;
    // CJK / full-width ranges account for roughly one token per character.
    if (
      (code >= 0x4e00 && code <= 0x9fff) || // CJK Unified Ideographs
      (code >= 0x3040 && code <= 0x30ff) || // Hiragana + Katakana
      (code >= 0xac00 && code <= 0xd7af) || // Hangul
      (code >= 0xff00 && code <= 0xff60) // Fullwidth forms
    ) {
      count += 1;
    } else {
      count += 1 / 4;
    }
  }
  // Round up to a whole number; never 0 for non-empty input.
  return Math.max(1, Math.ceil(count));
}

export function hasSufficientContent(text: string): boolean {
  return text.replace(/\s+/g, ' ').trim().length >= 1;
}