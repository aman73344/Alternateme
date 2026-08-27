import { isIP } from 'net';
import { lookup } from 'dns/promises';
import { config } from '@/config';
import { validateSourceUrl } from '@/sources/source-security';
import { KnowledgeError } from './knowledge.errors';

export interface FetchedResource {
  url: string; // final URL after redirects (every hop validated)
  buffer: Buffer;
  contentType: string;
  status: number;
}

export interface FetchUrlOptions {
  timeoutMs?: number;
  maxRedirects?: number;
  maxResponseSize?: number;
  userAgent?: string;
}

/** IPv4 private/reserved subnet checks (10/8, 172.16/12, 192.168/16, ...). */
function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4) return false;
  const [a, b] = parts;
  if (a === 10) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 127) return true; // loopback
  if (a === 0) return true; // "this" network
  if (a === 169 && b === 254) return true; // link-local
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  if (a === 192 && b === 0) return true; // 192.0.0.0/24
  return false;
}

/** IPv6 private/reserved prefixes (loopback, link-local, unique-local, mapped). */
function isPrivateIPv6(ip: string): boolean {
  const lower = ip.toLowerCase();
  return (
    lower === '::1' ||
    lower.startsWith('fc') || // fc00::/7 unique local
    lower.startsWith('fd') || // fd00::/7 unique local
    lower.startsWith('fe8') || // fe80::/10 link-local
    lower.startsWith('fe9') ||
    lower.startsWith('fea') ||
    lower.startsWith('feb') ||
    lower.includes('::ffff:127.') // IPv4-mapped loopback
  );
}

export function isPrivateAddress(address: string): boolean {
  const version = isIP(address);
  if (version === 4) return isPrivateIPv4(address);
  if (version === 6) return isPrivateIPv6(address);
  return true; // non-IP or malformed — treat as unsafe
}

/**
 * Defence-in-depth DNS guard: resolves every hostname and rejects any address
 * in private/reserved space BEFORE a socket is ever opened. This blocks cloud
 * metadata endpoints (169.254.169.254), localhost tricks and DNS rebinding
 * aimed at internal networks.
 */
export async function assertHostnameSafe(hostname: string): Promise<void> {
  const validation = validateSourceUrl(`https://${hostname}/`);
  if (!validation.valid) {
    throw new KnowledgeError(validation.error || 'URL_BLOCKED', { hostname }, 'Hostname is blocked by ingestion policy');
  }
  let addresses: { address: string }[];
  try {
    addresses = await lookup(hostname, { all: true, verbatim: true });
  } catch {
    throw new KnowledgeError('FETCH_FAILED', { hostname }, 'Unable to resolve host');
  }
  if (addresses.length === 0) {
    throw new KnowledgeError('FETCH_FAILED', { hostname }, 'Hostname resolved to no addresses');
  }
  if (addresses.some(({ address }) => isPrivateAddress(address))) {
    throw new KnowledgeError('SSRF_BLOCKED', { hostname }, 'URL resolves to a private or reserved address');
  }
}

export const ACCEPTED_CONTENT_TYPES = [
  'text/html',
  'text/plain',
  'text/markdown',
  'application/xhtml+xml',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

export function isAcceptedContentType(type: string): boolean {
  const t = type.split(';')[0].trim().toLowerCase();
  return ACCEPTED_CONTENT_TYPES.includes(t) || t.startsWith('text/');
}

/**
 * SSRF-safe HTTP(S) fetch. Every redirect target is re-validated (DNS + each
 * IP checked against private/reserved ranges, protocol enforced). The body is
 * streamed and hard-capped, and content-type is checked before indexing so we
 * never index binary/unknown types.
 */
export async function fetchUrl(
  rawUrl: string,
  options: FetchUrlOptions = {},
): Promise<FetchedResource> {
  const timeoutMs = options.timeoutMs ?? config.knowledge.url.timeoutMs;
  const maxRedirects = options.maxRedirects ?? config.knowledge.url.maxRedirects;
  const maxResponseSize = options.maxResponseSize ?? config.knowledge.url.maxResponseSize;
  const userAgent = options.userAgent ?? config.knowledge.url.userAgent;

  let current = rawUrl;
  let redirects = 0;

  for (;;) {
    const validation = validateSourceUrl(current);
    if (!validation.valid) {
      throw new KnowledgeError(validation.error || 'INVALID_URL', { url: current });
    }
    const parsed = new URL(current);
    await assertHostnameSafe(parsed.hostname);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let res: Response;
    try {
      res = await fetch(current, {
        redirect: 'manual',
        headers: { 'user-agent': userAgent, Accept: ACCEPTED_CONTENT_TYPES.join(', ') },
        signal: controller.signal,
      });
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw new KnowledgeError('FETCH_TIMEOUT', { url: current });
      }
      throw new KnowledgeError(
        'FETCH_FAILED',
        { url: current },
        err instanceof Error ? err.message : undefined,
      );
    } finally {
      clearTimeout(timer);
    }

    // Redirect — revalidate the new target and loop.
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get('location');
      await res.body?.cancel().catch(() => {});
      if (!location || redirects >= maxRedirects) {
        throw new KnowledgeError(
          'URL_BLOCKED',
          { url: current, status: res.status },
          'Too many redirects',
        );
      }
      current = new URL(location, current).toString();
      redirects += 1;
      continue;
    }

    if (res.status === 200 || res.status === 201) {
      const contentType = res.headers.get('content-type') || '';
      if (!isAcceptedContentType(contentType)) {
        throw new KnowledgeError(
          'URL_BLOCKED',
          { url: current, contentType },
          'Response content type is not ingestible',
        );
      }

      const chunks: Buffer[] = [];
      let size = 0;
      if (!res.body) {
        throw new KnowledgeError('FETCH_FAILED', { url: current }, 'Empty response body');
      }
      const reader = res.body.getReader();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        const buf = Buffer.from(value);
        size += buf.length;
        if (size > maxResponseSize) {
          await reader.cancel().catch(() => {});
          throw new KnowledgeError('CONTENT_TOO_LARGE', { url: current });
        }
        chunks.push(buf);
      }
      return { url: current, buffer: Buffer.concat(chunks), contentType, status: res.status };
    }

    await res.body?.cancel().catch(() => {});
    throw new KnowledgeError('FETCH_FAILED', { url: current, status: res.status });
  }
}

