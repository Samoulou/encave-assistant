import { createHash, randomBytes, createCipheriv, createDecipheriv, timingSafeEqual } from 'node:crypto';

export const opaqueToken = () => randomBytes(32).toString('base64url');
export const tokenHash = (token: string) => createHash('sha256').update(token).digest('hex');
export const validToken = (value: unknown): value is string => typeof value === 'string' && /^[A-Za-z0-9_-]{43}$/.test(value);
export const validUuid = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);

export { AccessError as IdentityError } from '@encave/tenancy';

export function equalToken(a: string, b: string): boolean {
  return validToken(a) && validToken(b) && timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

export function sealFlow(value: object, key: string): string {
  if (!/^[a-f0-9]{64}$/i.test(key)) throw new Error('Invalid encryption key');
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', Buffer.from(key, 'hex'), iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64url');
}

export function openFlow(value: string, key: string): { verifier: string; nonce: string } {
  const data = Buffer.from(value, 'base64url');
  const decipher = createDecipheriv('aes-256-gcm', Buffer.from(key, 'hex'), data.subarray(0, 12));
  decipher.setAuthTag(data.subarray(12, 28));
  const result = JSON.parse(Buffer.concat([decipher.update(data.subarray(28)), decipher.final()]).toString('utf8'));
  if (!validToken(result.verifier) || !validToken(result.nonce)) throw new Error('Invalid flow');
  return result;
}

export function readCookie(header: string | undefined, name: string): string {
  const matches = (header ?? '').split(';').map(s => s.trim()).filter(s => s.startsWith(name + '='));
  return matches.length === 1 ? matches[0]!.slice(name.length + 1) : '';
}
