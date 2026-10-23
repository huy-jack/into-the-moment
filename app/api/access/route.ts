import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { SESSION_COOKIE, SESSION_TTL_MS } from '@/src/config';
import { errorResponse } from '@/src/server/http';
import { hasSession, safeEqual, signSession } from '@/src/server/session';

const Body = z.object({ code: z.string().max(200) });

/** Lets the page skip the code screen when the cookie is still valid. Reveals nothing else. */
export async function GET(req: NextRequest) {
  return NextResponse.json({ ok: hasSession(req) });
}

export async function POST(req: NextRequest) {
  const code = process.env.ACCESS_CODE;
  const secret = process.env.SESSION_SECRET;
  if (!code || !secret) return NextResponse.json({ error: { code: 'PROVIDER_ERROR', message: 'Server is not configured.' } }, { status: 500 });

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success || !safeEqual(parsed.data.code.trim(), code)) return errorResponse(401, 'BAD_CODE');

  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, signSession(secret, Date.now()), {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  });
  return res;
}

/** Log out: the cookie is cleared, so the next visit starts at the code screen. Jobs stay at their links. */
export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, '', { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 0 });
  return res;
}
