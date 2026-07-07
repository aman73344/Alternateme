import crypto from 'crypto';

export function createRandomToken(size = 48): string {
  return crypto.randomBytes(size).toString('hex');
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}
