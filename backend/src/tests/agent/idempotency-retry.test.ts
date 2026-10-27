/**
 * Phase 6 — idempotency and retry-policy unit tests.
 */

import { describe, it, expect, vi } from 'vitest';
import { canonicalize, deriveIdempotencyKey } from '@/agent/execution/idempotency.service';
import { isRetryable, backoffMs, withRetry } from '@/agent/execution/retry-policy';
import { AgentError } from '@/agent/agent.errors';

const ALT_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const ALT_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

describe('idempotency key derivation', () => {
  it('is deterministic for the same action', () => {
    const a = deriveIdempotencyKey(ALT_A, 'send_email', { to: 'x@y.com' });
    const b = deriveIdempotencyKey(ALT_A, 'send_email', { to: 'x@y.com' });
    expect(a).toBe(b);
  });

  it('is stable regardless of key order', () => {
    const a = deriveIdempotencyKey(ALT_A, 't', { a: 1, b: 2 });
    const b = deriveIdempotencyKey(ALT_A, 't', { b: 2, a: 1 });
    expect(a).toBe(b);
  });

  it('differs for different arguments', () => {
    expect(deriveIdempotencyKey(ALT_A, 't', { a: 1 })).not.toBe(
      deriveIdempotencyKey(ALT_A, 't', { a: 2 }),
    );
  });

  it('is scoped per alternate (tenant isolation)', () => {
    expect(deriveIdempotencyKey(ALT_A, 't', { a: 1 })).not.toBe(
      deriveIdempotencyKey(ALT_B, 't', { a: 1 }),
    );
  });

  it('is scoped per tool', () => {
    expect(deriveIdempotencyKey(ALT_A, 'tool_one', { a: 1 })).not.toBe(
      deriveIdempotencyKey(ALT_A, 'tool_two', { a: 1 }),
    );
  });

  it('produces a hex key of bounded length', () => {
    const key = deriveIdempotencyKey(ALT_A, 't', { a: 1 });
    expect(key).toMatch(/^[0-9a-f]{64}$/);
  });

  it('canonicalizes nested structures and preserves array order', () => {
    expect(canonicalize({ a: [1, 2] })).not.toBe(canonicalize({ a: [2, 1] }));
    expect(canonicalize({ a: { b: 1 } })).toBe(canonicalize({ a: { b: 1 } }));
  });

  it('drops undefined values so absent and undefined agree', () => {
    expect(canonicalize({ a: 1, b: undefined })).toBe(canonicalize({ a: 1 }));
  });
});

describe('retry policy classification', () => {
  it('retries transient errors', () => {
    expect(isRetryable(AgentError.from('TOOL_TIMEOUT'))).toBe(true);
    expect(isRetryable(AgentError.from('AGENT_PROVIDER_UNAVAILABLE'))).toBe(true);
    expect(isRetryable(AgentError.from('AGENT_RATE_LIMITED'))).toBe(true);
    expect(isRetryable({ code: 'NETWORK_ERROR' })).toBe(true);
    expect(isRetryable({ code: 'ECONNRESET' })).toBe(true);
  });

  it('never retries terminal errors', () => {
    expect(isRetryable(AgentError.from('TOOL_INVALID_INPUT'))).toBe(false);
    expect(isRetryable(AgentError.from('TOOL_NOT_ALLOWED'))).toBe(false);
    expect(isRetryable(AgentError.from('TOOL_APPROVAL_REJECTED'))).toBe(false);
    expect(isRetryable(AgentError.from('AGENT_MAX_STEPS'))).toBe(false);
    expect(isRetryable({ code: 'FORBIDDEN' })).toBe(false);
    expect(isRetryable({ code: 'PERMANENT_FAILURE' })).toBe(false);
  });

  it('never retries an arbitrary unknown error', () => {
    expect(isRetryable(new Error('boom'))).toBe(false);
  });
});

describe('retry backoff', () => {
  it('grows exponentially and is capped', () => {
    expect(backoffMs(1)).toBe(250);
    expect(backoffMs(2)).toBe(500);
    expect(backoffMs(3)).toBe(1000);
    expect(backoffMs(20)).toBeLessThanOrEqual(4000);
  });
});

describe('withRetry', () => {
  it('returns the first successful result', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    await expect(withRetry(fn, { maxAttempts: 3 })).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries a transient failure then succeeds', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(AgentError.from('TOOL_TIMEOUT'))
      .mockResolvedValue('ok');
    await expect(withRetry(fn, { maxAttempts: 3 })).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('does not retry a terminal failure', async () => {
    const fn = vi.fn().mockRejectedValue(AgentError.from('TOOL_INVALID_INPUT'));
    await expect(withRetry(fn, { maxAttempts: 3 })).rejects.toMatchObject({
      code: 'TOOL_INVALID_INPUT',
    });
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('gives up after maxAttempts on a persistent transient failure', async () => {
    const fn = vi.fn().mockRejectedValue(AgentError.from('TOOL_TIMEOUT'));
    await expect(withRetry(fn, { maxAttempts: 2 })).rejects.toMatchObject({
      code: 'TOOL_TIMEOUT',
    });
    expect(fn).toHaveBeenCalledTimes(2);
  });
});
