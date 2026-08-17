import { describe, it, expect } from 'vitest';
import { validateSourceUrl } from '@/sources/source-security';

describe('SSRF URL Validation', () => {
  it('accepts valid public HTTPS URLs', () => {
    const result = validateSourceUrl('https://example.com/article');
    expect(result.valid).toBe(true);
  });

  it('accepts valid public HTTP URLs', () => {
    const result = validateSourceUrl('http://example.com/article');
    expect(result.valid).toBe(true);
  });

  it('rejects file:// protocol', () => {
    const result = validateSourceUrl('file:///etc/passwd');
    expect(result.valid).toBe(false);
  });

  it('rejects ftp:// protocol', () => {
    const result = validateSourceUrl('ftp://example.com/file');
    expect(result.valid).toBe(false);
  });

  it('rejects data: protocol', () => {
    const result = validateSourceUrl('data:text/html;base64,PHNjcmlwdD4=');
    expect(result.valid).toBe(false);
  });

  it('rejects javascript: protocol', () => {
    const result = validateSourceUrl('javascript:alert(1)');
    expect(result.valid).toBe(false);
  });

  it('rejects localhost', () => {
    const result = validateSourceUrl('http://localhost:3000');
    expect(result.valid).toBe(false);
  });

  it('rejects 127.0.0.1 loopback', () => {
    const result = validateSourceUrl('http://127.0.0.1:3000/private');
    expect(result.valid).toBe(false);
  });

  it('rejects 10.x private range', () => {
    const result = validateSourceUrl('http://10.0.0.1/internal');
    expect(result.valid).toBe(false);
  });

  it('rejects 192.168.x private range', () => {
    const result = validateSourceUrl('http://192.168.1.1/admin');
    expect(result.valid).toBe(false);
  });

  it('rejects 172.16.x private range', () => {
    const result = validateSourceUrl('http://172.16.0.1/internal');
    expect(result.valid).toBe(false);
  });

  it('rejects metadata service', () => {
    const result = validateSourceUrl('http://metadata.google.internal/computeMetadata/v1/');
    expect(result.valid).toBe(false);
  });

  it('rejects invalid URL format', () => {
    const result = validateSourceUrl('not-a-url');
    expect(result.valid).toBe(false);
  });
});