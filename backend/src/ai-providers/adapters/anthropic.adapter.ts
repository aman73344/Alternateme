import { AIProviderAdapter, ProviderValidationResult } from '../provider.types';

/**
 * Anthropic provider adapter.
 *
 * Validates API keys via the Anthropic messages API.
 * This is a lightweight connectivity check that never logs the key.
 * Phase 5 will extend this adapter for actual chat completions.
 */
export class AnthropicAdapter implements AIProviderAdapter {
  readonly name = 'ANTHROPIC' as const;

  async validateApiKey(apiKey: string): Promise<ProviderValidationResult> {
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1,
          messages: [{ role: 'user', content: 'ping' }],
        }),
        signal: AbortSignal.timeout(10_000),
      });

      if (response.ok) {
        return { valid: true };
      }

      return { valid: false, error: `Anthropic API key validation failed (HTTP ${response.status})` };
    } catch {
      return { valid: false, error: 'Anthropic API key validation failed' };
    }
  }
}