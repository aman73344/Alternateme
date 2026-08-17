/**
 * SSRF protection for URL-based training sources.
 *
 * This phase only validates the URL. The actual SSRF-safe fetching
 * will be implemented in Phase 3 with the ingestion worker.
 */

// Private/reserved network ranges we must never fetch
const PRIVATE_IP_PATTERNS = [
  /^10\./, // 10.0.0.0/8
  /^192\.168\./, // 192.168.0.0/16
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./, // 172.16.0.0/12
  /^127\./, // loopback
  /^169\.254\./, // link-local
  /^0\./, // "this" network
  /^100\.(6[4-9]|[7-9][0-9]|1[01][0-9]|12[0-7])\./, // CGNAT 100.64.0.0/10
  /^::1$/, // IPv6 loopback
];

const BLOCKED_PROTOCOLS = ['file:', 'ftp:', 'ftps:', 'gopher:', 'dict:', 'ldap:', 'ldaps:', 'telnet:', 'smb:', 'data:', 'javascript:'];

const BLOCKED_HOSTNAMES = ['localhost', 'localhost.localdomain', 'metadata.google.internal', 'metadata', 'puppet', 'consul', 'docker', 'kubernetes'];

/**
 * Validate a URL for safe ingestion.
 * Rejects unsafe protocols, localhost, private IP ranges, and blocked hostnames.
 */
export function validateSourceUrl(rawUrl: string): { valid: boolean; error?: string } {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return { valid: false, error: 'Invalid URL format' };
  }

  // Protocol check
  if (BLOCKED_PROTOCOLS.includes(url.protocol)) {
    return { valid: false, error: `Protocol "${url.protocol}" is not allowed` };
  }

  // Only http/https allowed
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return { valid: false, error: 'Only HTTP and HTTPS URLs are supported' };
  }

  // Hostname check
  const hostname = url.hostname.toLowerCase();

  if (BLOCKED_HOSTNAMES.includes(hostname)) {
    return { valid: false, error: 'Hostname is not allowed' };
  }

  // IP-based check for private ranges
  if (PRIVATE_IP_PATTERNS.some((pattern) => pattern.test(hostname))) {
    return { valid: false, error: 'Private network addresses are not allowed' };
  }

  return { valid: true };
}