import { createHmac, timingSafeEqual } from 'node:crypto';
import type { NextRequest } from 'next/server';
import { SESSION_COOKIE, SESSION_TTL_MS } from '../config';

const hmac = (secret: string, data: string) => createHmac('sha256', secret).update(data).digest('hex');

/** Cookie value `v1.{expiresAtMs}.{hmacHex}`. */
export function signSession(secret: string, now: number): string {
  const payload = `v1.${now + SESSION_TTL_MS}`;
  return `${payload}.${hmac(secret, payload)}`;
}

export function verifySession(secret: string, value: string | undefined, now: number): boolean {
  if (!value) return false;
  const parts = value.split('.');
  if (parts.length !== 3 || parts[0] !== 'v1') return false;
  const expires = Number(parts[1]);
  if (!Number.isFinite(expires) || expires < now) return false;
  const want = Buffer.from(hmac(secret, `${parts[0]}.${parts[1]}`));
  const got = Buffer.from(parts[2]);
  return want.length === got.length && timingSafeEqual(want, got);
}

/** Constant-time comparison of two strings of any length. */
export function safeEqual(a: string, b: string): boolean {
  const ha = createHmac('sha256', 'cmp').update(a).digest();
  const hb = createHmac('sha256', 'cmp').update(b).digest();
  return timingSafeEqual(ha, hb);
}

export function hasSession(req: NextRequest, now = Date.now()): boolean {
  const secret = process.env.SESSION_SECRET;
  return !!secret && verifySession(secret, req.cookies.get(SESSION_COOKIE)?.value, now);
}
