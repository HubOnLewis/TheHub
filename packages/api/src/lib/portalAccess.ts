import { createHmac, timingSafeEqual } from 'node:crypto';

type PortalPayload = {
  e: string;
  exp: number;
};

function b64url(buf: Buffer | string): string {
  const b = typeof buf === 'string' ? Buffer.from(buf, 'utf8') : buf;
  return b.toString('base64url');
}

export function signPortalAccessToken(eventId: string, secret: string, ttlDays = 90): string {
  const payload: PortalPayload = {
    e: eventId,
    exp: Math.floor(Date.now() / 1000) + ttlDays * 86_400,
  };
  const body = b64url(JSON.stringify(payload));
  const sig = createHmac('sha256', secret).update(body).digest('base64url');
  return `${body}.${sig}`;
}

export function verifyPortalAccessToken(token: string, secret: string): { eventId: string } | null {
  const parts = token.split('.');
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  const [body, sig] = parts;
  const expected = createHmac('sha256', secret).update(body).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as PortalPayload;
    if (!payload.e || typeof payload.exp !== 'number') return null;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return { eventId: payload.e };
  } catch {
    return null;
  }
}
