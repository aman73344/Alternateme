import { describe, it, expect } from 'vitest';
import { generateSlug, maskEmail, maskApiKey, truncate } from '@/helpers';

describe('generateSlug', () => {
  it('converts text to slug', () => {
    expect(generateSlug('Hello World')).toBe('hello-world');
  });

  it('handles special characters', () => {
    expect(generateSlug('My Alternate! @Work')).toBe('my-alternate-work');
  });

  it('trims hyphens', () => {
    expect(generateSlug('  hello  ')).toBe('hello');
  });
});

describe('maskEmail', () => {
  it('masks email', () => {
    expect(maskEmail('john@example.com')).toBe('j***n@example.com');
  });
});

describe('maskApiKey', () => {
  it('masks API key', () => {
    expect(maskApiKey('sk-1234567890abcdef')).toBe('sk-1...cdef');
  });

  it('handles short keys', () => {
    expect(maskApiKey('abc')).toBe('***');
  });
});

describe('truncate', () => {
  it('truncates long strings', () => {
    expect(truncate('Hello World', 8)).toBe('Hello...');
  });

  it('keeps short strings', () => {
    expect(truncate('Hi', 10)).toBe('Hi');
  });
});
