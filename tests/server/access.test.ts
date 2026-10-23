import { NextRequest } from 'next/server';
import { beforeAll, describe, expect, it } from 'vitest';
import { DELETE as accessDelete, GET as accessGet, POST as accessPost } from '@/app/api/access/route';
import { SESSION_COOKIE, SESSION_TTL_MS } from '@/src/config';
import { signSession, verifySession } from '@/src/server/session';
import { proxy } from '@/proxy';

const SECRET = 'test-secret-0123456789';

beforeAll(() => {
  process.env.SESSION_SECRET = SECRET;
  process.env.ACCESS_CODE = 'swap-2026';
});

describe('session', () => {
  it('accepts a fresh session', () => {
    expect(verifySession(SECRET, signSession(SECRET, 1000), 2000)).toBe(true);
  });
  it('rejects a tampered hmac, an expired value and undefined', () => {
    const v = signSession(SECRET, 1000);
    expect(verifySession(SECRET, v.slice(0, -1) + (v.endsWith('0') ? '1' : '0'), 2000)).toBe(false);
    expect(verifySession(SECRET, v, 1000 + SESSION_TTL_MS + 1)).toBe(false);
    expect(verifySession(SECRET, undefined, 2000)).toBe(false);
  });
});

const post = (body: unknown) =>
  new NextRequest('http://localhost/api/access', { method: 'POST', body: JSON.stringify(body) });

describe('POST /api/access', () => {
  it('sets cs_session on the right code', async () => {
    const res = await accessPost(post({ code: 'swap-2026' }));
    expect(res.status).toBe(200);
    const cookie = res.headers.get('set-cookie') ?? '';
    expect(cookie).toContain(`${SESSION_COOKIE}=`);
    expect(cookie.toLowerCase()).toContain('httponly');
  });
  it('returns the BAD_CODE copy on a wrong code', async () => {
    const res = await accessPost(post({ code: 'nope' }));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({
      error: { code: 'BAD_CODE', message: 'That code is not right. Check the email you got.' },
    });
  });
});

describe('GET /api/access', () => {
  const get = (cookie?: string) =>
    new NextRequest('http://localhost/api/access', { headers: cookie ? { cookie: `${SESSION_COOKIE}=${cookie}` } : {} });
  it('says whether the browser already holds a valid session, so the app skips the code screen', async () => {
    expect(await (await accessGet(get(signSession(SECRET, Date.now())))).json()).toEqual({ ok: true });
    expect(await (await accessGet(get())).json()).toEqual({ ok: false });
    expect(await (await accessGet(get('v1.1.bad'))).json()).toEqual({ ok: false });
  });
});

describe('DELETE /api/access', () => {
  it('logs out: clears the session cookie, so the next visit shows the code screen', async () => {
    const res = await accessDelete();
    expect(res.status).toBe(200);
    const cookie = (res.headers.get('set-cookie') ?? '').toLowerCase();
    expect(cookie).toContain(`${SESSION_COOKIE}=;`);
    expect(cookie).toContain('max-age=0');
    expect(cookie).toContain('path=/');
  });
});

describe('proxy', () => {
  const req = (path: string, cookie?: string) =>
    new NextRequest(`http://localhost${path}`, { headers: cookie ? { cookie: `${SESSION_COOKIE}=${cookie}` } : {} });

  it('returns 401 for /api/jobs without a cookie', async () => {
    expect((await proxy(req('/api/jobs'))).status).toBe(401);
  });
  it('passes /api/jobs with a valid cookie', async () => {
    const res = await proxy(req('/api/jobs', signSession(SECRET, Date.now())));
    expect(res.status).toBe(200);
    expect(res.headers.get('x-middleware-next')).toBe('1');
  });
  it('passes /api/access and the workflow route without a cookie', async () => {
    expect((await proxy(req('/api/access'))).headers.get('x-middleware-next')).toBe('1');
    const out = new NextRequest('http://localhost/api/access', { method: 'DELETE' });
    expect((await proxy(out)).headers.get('x-middleware-next')).toBe('1');
    expect((await proxy(req('/.well-known/workflow/v1/step'))).headers.get('x-middleware-next')).toBe('1');
  });
});
