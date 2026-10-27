/**
 * LLM Provider abstraction for chat completions.
 *
 * Supports multiple providers (OpenAI, Anthropic) with a unified interface.
 * API keys are decrypted only when needed and never logged or exposed.
 */

import { config } from '@/config';
import { logger } from '@/utils/logger';
import type { LLMChatRequest, LLMChatResponse, LLMToolCall } from './types';

/**
 * Build the provider-neutral message list for OpenAI, including the
 * assistant `tool_calls` / `role: "tool"` pairing OpenAI requires when the
 * agent loop feeds tool results back in.
 */
function buildOpenAIMessages(request: LLMChatRequest): Array<Record<string, unknown>> {
  const messages: Array<Record<string, unknown>> = request.messages.map((m) => ({
    role: m.role.toLowerCase(),
    content: m.content,
  }));

  if (request.toolResults && request.toolResults.length > 0) {
    messages.push({
      role: 'assistant',
      content: null,
      tool_calls: request.toolResults.map((r) => ({
        id: r.toolCallId,
        type: 'function',
        function: { name: r.name, arguments: '{}' },
      })),
    });
    for (const r of request.toolResults) {
      messages.push({ role: 'tool', tool_call_id: r.toolCallId, content: r.content });
    }
  }

  return messages;
}

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
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: buildOpenAIMessages(request),
        max_tokens: maxTokens,
        temperature,
        stream: false,
        ...(request.tools && request.tools.length > 0
          ? {
              tools: request.tools.map((t) => ({
                type: 'function',
                function: {
                  name: t.name,
                  description: t.description,
                  parameters: t.parameters,
                },
              })),
              tool_choice: request.toolChoice === 'none' ? 'none' : 'auto',
            }
          : {}),
      }),
      signal: AbortSignal.timeout(60000),
    });

    if (!response.ok) {
      await response.text();
      logger.error({ status: response.status }, 'OpenAI API error');
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = (await response.json()) as {
      choices: Array<{
        message: {
          content: string | null;
          tool_calls?: Array<{ id: string; function: { name: string; arguments: string } }>;
        };
        finish_reason: string;
      }>;
      usage?: { total_tokens: number };
      model: string;
    };

    const choice = data.choices[0];
    const toolCalls: LLMToolCall[] = (choice?.message?.tool_calls ?? []).map((tc) => {
      let parsed: unknown = {};
      try {
        parsed = tc.function?.arguments ? JSON.parse(tc.function.arguments) : {};
      } catch {
        // Malformed arguments stay unparseable on purpose: the agent layer
        // rejects them as TOOL_INVALID_INPUT rather than guessing a value.
        parsed = undefined;
      }
      return { id: tc.id, name: tc.function?.name ?? '', arguments: parsed };
    });

    return {
      content: choice?.message?.content ?? '',
      tokensUsed: data.usage?.total_tokens,
      model: data.model,
      finishReason: choice?.finish_reason,
      ...(toolCalls.length > 0 ? { toolCalls } : {}),
    };
  }

  getModelInfo(): { name: string; maxTokens: number } {
    return { name: config.ai.openai.model, maxTokens: 128000 };
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch('https://api.openai.com/v1/models', {
        headers: { Authorization: `Bearer ${config.ai.openai.apiKey}` },
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

    const anthropicMessages: Array<{ role: 'user' | 'assistant'; content: unknown }> =
      conversationMessages.map((m) => ({
        role: m.role === 'USER' ? ('user' as const) : ('assistant' as const),
        content: m.content,
      }));

    if (request.toolResults && request.toolResults.length > 0) {
      // Anthropic requires the assistant tool_use block to immediately precede
      // the user tool_result blocks.
      anthropicMessages.push({
        role: 'assistant',
        content: request.toolResults.map((r) => ({
          type: 'tool_use',
          id: r.toolCallId,
          name: r.name,
          input: {},
        })),
      });
      anthropicMessages.push({
        role: 'user',
        content: request.toolResults.map((r) => ({
          type: 'tool_result',
          tool_use_id: r.toolCallId,
          content: r.content,
        })),
      });
    }

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
        messages: anthropicMessages,
        ...(request.tools && request.tools.length > 0
          ? {
              tools: request.tools.map((t) => ({
                name: t.name,
                description: t.description,
                input_schema: t.parameters,
              })),
            }
          : {}),
      }),
      signal: AbortSignal.timeout(120000),
    });

    if (!response.ok) {
      await response.text();
      logger.error({ status: response.status }, 'Anthropic API error');
      throw new Error(`Anthropic API error: ${response.status}`);
    }

    const data = (await response.json()) as {
      content: Array<{
        type: string;
        text?: string;
        id?: string;
        name?: string;
        input?: unknown;
      }>;
      usage?: { input_tokens: number; output_tokens: number };
      model: string;
      stop_reason: string;
    };

    const content = data.content
      .filter((c) => c.type === 'text')
      .map((c) => c.text ?? '')
      .join('');

    const toolCalls: LLMToolCall[] = data.content
      .filter((c) => c.type === 'tool_use' && c.id && c.name)
      .map((c) => ({ id: c.id as string, name: c.name as string, arguments: c.input ?? {} }));

    return {
      content,
      tokensUsed: data.usage ? data.usage.input_tokens + data.usage.output_tokens : undefined,
      model: data.model,
      finishReason: data.stop_reason,
      ...(toolCalls.length > 0 ? { toolCalls } : {}),
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
export function createLLMProvider(
  providerName: 'OPENAI' | 'ANTHROPIC',
): OpenAIProvider | AnthropicProvider {
  switch (providerName) {
    case 'OPENAI':
      return new OpenAIProvider();
    case 'ANTHROPIC':
      return new AnthropicProvider();
    default:
      throw new Error(`Unsupported LLM provider: ${providerName}`);
  }
}
