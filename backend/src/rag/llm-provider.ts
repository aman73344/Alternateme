/**
 * LLM Provider abstraction for chat completions.
 * 
 * Supports multiple providers (OpenAI, Anthropic) with a unified interface.
 * API keys are decrypted only when needed and never logged or exposed.
 */

import { config } from '@/config';
import { logger } from '@/utils/logger';
import type { LLMChatRequest, LLMChatResponse } from './types';

/**
 * OpenAI Chat Completion Provider
 */
export class OpenAIProvider {
  readonly name = 'OPENAI' as const;

  async generateChatCompletion(request: LLMChatRequest): Promise<LLMChatResponse> {
    const apiKey = config.ai.openai.apiKey;
    const model = request.model || config.ai.openai.model;
    const maxTokens = request.maxTokens || 1024;
    const temperature = request.temperature ?? 0.7;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: request.messages.map((m) => ({
          role: m.role.toLowerCase(),
          content: m.content,
        })),
        max_tokens: maxTokens,
        temperature,
        stream: false,
      }),
      signal: AbortSignal.timeout(60000),
    });

    if (!response.ok) {
      await response.text();
      logger.error({ status: response.status }, 'OpenAI API error');
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json() as {
      choices: Array<{ message: { content: string }; finish_reason: string }>;
      usage?: { total_tokens: number };
      model: string;
    };

    return {
      content: data.choices[0]?.message?.content ?? '',
      tokensUsed: data.usage?.total_tokens,
      model: data.model,
      finishReason: data.choices[0]?.finish_reason,
    };
  }

  getModelInfo(): { name: string; maxTokens: number } {
    return { name: config.ai.openai.model, maxTokens: 128000 };
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch('https://api.openai.com/v1/models', {
        headers: { 'Authorization': `Bearer ${config.ai.openai.apiKey}` },
        signal: AbortSignal.timeout(10000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}

/**
 * Anthropic Chat Completion Provider
 */
export class AnthropicProvider {
  readonly name = 'ANTHROPIC' as const;

  async generateChatCompletion(request: LLMChatRequest): Promise<LLMChatResponse> {
    const apiKey = config.ai.anthropic.apiKey;
    const model = request.model || config.ai.anthropic.model;
    const maxTokens = request.maxTokens || 1024;
    const temperature = request.temperature ?? 0.7;

    const systemMessages = request.messages.filter((m) => m.role === 'SYSTEM');
    const conversationMessages = request.messages.filter((m) => m.role !== 'SYSTEM');
    const systemContent = systemMessages.map((m) => m.content).join('\n\n');

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        temperature,
        ...(systemContent ? { system: systemContent } : {}),
        messages: conversationMessages.map((m) => ({
          role: m.role === 'USER' ? 'user' : 'assistant',
          content: m.content,
        })),
      }),
      signal: AbortSignal.timeout(120000),
    });

    if (!response.ok) {
      logger.error({ status: response.status }, 'Anthropic API error');
      throw new Error(`Anthropic API error: ${response.status}`);
    }

    const data = await response.json() as {
      content: Array<{ type: string; text: string }>;
      usage?: { input_tokens: number; output_tokens: number };
      model: string;
      stop_reason: string;
    };

    const content = data.content
      .filter((c) => c.type === 'text')
      .map((c) => c.text)
      .join('');

    return {
      content,
      tokensUsed: data.usage ? data.usage.input_tokens + data.usage.output_tokens : undefined,
      model: data.model,
      finishReason: data.stop_reason,
    };
  }

  getModelInfo(): { name: string; maxTokens: number } {
    return { name: config.ai.anthropic.model, maxTokens: 200000 };
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': config.ai.anthropic.apiKey,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1,
          messages: [{ role: 'user', content: 'ping' }],
        }),
        signal: AbortSignal.timeout(10000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}

/**
 * Factory function to create the appropriate LLM provider.
 */
export function createLLMProvider(providerName: 'OPENAI' | 'ANTHROPIC'): OpenAIProvider | AnthropicProvider {
  switch (providerName) {
    case 'OPENAI':
      return new OpenAIProvider();
    case 'ANTHROPIC':
      return new AnthropicProvider();
    default:
      throw new Error(`Unsupported LLM provider: ${providerName}`);
  }
}
