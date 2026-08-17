import { AIProviderAdapter, ProviderValidationResult } from '../provider.types';

/**
 * OpenAI provider adapter.
 *
 * Validates API keys by listing models via the OpenAI API.
 * This is a lightweight connectivity check that never logs the key.
 * Phase 5 will extend this adapter for actual chat completions.
 */
export class OpenAIAdapter implements AIProviderAdapter {
  readonly name = 'OPENAI' as const;

  async validateApiKey(apiKey: string): Promise<ProviderValidationResult> {
    try {
      const response = await fetch('https://api.openai.com/v1/models', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        // Timeout to avoid hanging requests
        signal: AbortSignal.timeout(10_000),
      });

      if (response.ok) {
        return { valid: true };
      }

      return { valid: false, error: `OpenAI API key validation failed (HTTP ${response.status})` };
    } catch {
      return { valid: false, error: 'OpenAI API key validation failed' };
    }
  }
}