/**
 * Provider abstraction for AI provider configuration.
 *
 * Phase 5 (AI Integration) will consume this interface to call
 * OpenAI, Anthropic, and future providers without coupling
 * onboarding to any specific provider implementation.
 */

export type ProviderName = 'OPENAI' | 'ANTHROPIC';

export interface ProviderValidationResult {
  valid: boolean;
  model?: string;
  error?: string;
}

export interface AIProviderAdapter {
  /** Provider display name */
  readonly name: ProviderName;

  /**
   * Validate an API key by making a lightweight connectivity check.
   * This may be a model list call or a token-count request.
   * Must never log or expose the API key.
   */
  validateApiKey(apiKey: string): Promise<ProviderValidationResult>;
}

/** BYOK provider registry */
export class ProviderRegistry {
  private static adapters = new Map<ProviderName, AIProviderAdapter>();

  static register(adapter: AIProviderAdapter): void {
    ProviderRegistry.adapters.set(adapter.name, adapter);
  }

  static get(name: ProviderName): AIProviderAdapter {
    const adapter = ProviderRegistry.adapters.get(name);
    if (!adapter) {
      throw new Error(`Provider "${name}" is not registered`);
    }
    return adapter;
  }

  static has(name: string): boolean {
    return ProviderRegistry.adapters.has(name as ProviderName);
  }

  static registeredProviders(): ProviderName[] {
    return Array.from(ProviderRegistry.adapters.keys());
  }
}