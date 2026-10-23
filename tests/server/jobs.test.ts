import { PGlite } from '@electric-sql/pglite';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createRepo } from '@/src/db/repo';
import * as schema from '@/src/db/schema';
import { createDbLedger } from '@/src/ledger/dbLedger';
import { DEFAULT_OPTIONS } from '@/src/types';

const rt = vi.hoisted(() => ({ current: null as unknown }));
vi.mock('@/src/server/runtime', () => ({ runtime: () => rt.current }));

import { POST as createJob } from '@/app/api/jobs/route';
import { GET as getJob } from '@/app/api/jobs/[id]/route';
import { POST as rerun } from '@/app/api/jobs/[id]/rerun/route';

let db: ReturnType<typeof drizzle<typeof schema>>;
let started: string[];
let now: Date;

beforeEach(async () => {
  db = drizzle(new PGlite(), { schema });
  await migrate(db, { migrationsFolder: 'drizzle' });
  started = [];
  now = new Date();
  const existing = new Set(['uploads/t.jpg', 'uploads/u1.jpg', 'uploads/u2.jpg']);
  rt.current = {
    repo: createRepo(db as never),
    ledger: createDbLedger(db as never),
    store: {
      exists: async (p: string) => existing.has(p),
      signedUrl: async (p: string) => `https://signed/${p}`,
    },
    start: async (jobId: string) => {
      started.push(jobId);
    },
    now: () => now,
    spendCapUsd: 10,
  };
});

const post = (url: string, body: unknown) => new NextRequest(url, { method: 'POST', body: JSON.stringify(body) });
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const good = { templatePath: 'uploads/t.jpg', userPaths: ['uploads/u1.jpg', 'uploads/u2.jpg'] };

describe('POST /api/jobs', () => {
  it('rejects 0 and 5 user photos with 400', async () => {
    expect((await createJob(post('http://x/api/jobs', { ...good, userPaths: [] }))).status).toBe(400);
    const five = ['a', 'b', 'c', 'd', 'e'].map((s) => `uploads/${s}.jpg`);
    expect((await createJob(post('http://x/api/jobs', { ...good, userPaths: five }))).status).toBe(400);
  });

  it('rejects a path that was never uploaded with BAD_UPLOAD', async () => {
    const res = await createJob(post('http://x/api/jobs', { ...good, templatePath: 'uploads/missing.jpg' }));
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe('BAD_UPLOAD');
  });

  it('returns 429 JOB_CAP when the cap is hit and starts no workflow', async () => {
    const repo = createRepo(db as never);
    for (let i = 0; i < 20; i++) {
      await repo.createJob({ jobId: `old${i}`, templatePath: 't', userPaths: ['u'], options: DEFAULT_OPTIONS });
    }
    const res = await createJob(post('http://x/api/jobs', good));
    expect(res.status).toBe(429);
    expect((await res.json()).error.code).toBe('JOB_CAP');
    expect(started).toHaveLength(0);
  });

  it('returns 202 and starts the workflow once', async () => {
    const res = await createJob(post('http://x/api/jobs', good));
    expect(res.status).toBe(202);
    const { jobId } = await res.json();
    expect(started).toEqual([jobId]);
  });
});

describe('GET /api/jobs/:id', () => {
  async function newJob(ageS: number) {
    const res = await createJob(post('http://x/api/jobs', good));
    const { jobId } = await res.json();
    await db.update(schema.jobs).set({ createdAt: new Date(now.getTime() - ageS * 1000), updatedAt: now }).where(eq(schema.jobs.id, jobId));
    return jobId as string;
  }

  it('returns pollAfterMs 2000 for a 10 s old job and 5000 for a 40 s old job', async () => {
    const young = await newJob(10);
    const old = await newJob(40);
    expect((await (await getJob(new NextRequest('http://x'), ctx(young))).json()).pollAfterMs).toBe(2000);
    expect((await (await getJob(new NextRequest('http://x'), ctx(old))).json()).pollAfterMs).toBe(5000);
  });

  it('marks an 11 minute old running job STUCK and stops polling', async () => {
    const id = await newJob(700);
    await db.update(schema.jobs).set({ status: 'running', updatedAt: new Date(now.getTime() - 11 * 60_000) }).where(eq(schema.jobs.id, id));
    const body = await (await getJob(new NextRequest('http://x'), ctx(id))).json();
    expect(body.status).toBe('failed');
    expect(body.error.code).toBe('STUCK');
    expect(body.pollAfterMs).toBeUndefined();
  });

  it('signs links only once the job is finished, never raw paths', async () => {
    const id = await newJob(5);
    let signed = 0;
    (rt.current as { store: { signedUrl: (p: string) => Promise<string> } }).store.signedUrl = async (p: string) => {
      signed++;
      return `https://signed/${p}`;
    };
    const running = await (await getJob(new NextRequest('http://x'), ctx(id))).json();
    expect(running.inputs).toBeNull();
    expect(signed).toBe(0);

    await createRepo(db as never).saveCandidates(id, [
      { slot: 'a', model: 'gpt-image-2.5-flare', attempt: 1, path: `jobs/${id}/a-1.png`, refused: false, refusalText: null, failed: false, bodyCheck: null, score: 88 },
    ]);
    await createRepo(db as never).setStage(id, 'done', 'done');
    const body = await (await getJob(new NextRequest('http://x'), ctx(id))).json();
    expect(body.inputs.template).toBe('https://signed/uploads/t.jpg');
    expect(body.candidates[0].url).toBe(`https://signed/jobs/${id}/a-1.png`);
    expect(body.candidates[0].path).toBeUndefined();
  });

  it('a done job carries no old error', async () => {
    const id = await newJob(5);
    const repo = createRepo(db as never);
    await repo.setStage(id, 'failed', 'failed', { code: 'STUCK', message: 'x' });
    await repo.setStage(id, 'done', 'done');
    expect((await repo.getJob(id))?.error).toBeNull();
  });

  it('returns 404 for an unknown id', async () => {
    expect((await getJob(new NextRequest('http://x'), ctx('nope'))).status).toBe(404);
  });
});

describe('POST /api/jobs/:id/rerun', () => {
  it('problem scene sets maskOn, sceneEmphasis and the parent id', async () => {
    const parent = (await (await createJob(post('http://x/api/jobs', good))).json()).jobId;
    const res = await rerun(post('http://x', { problem: 'scene' }), ctx(parent));
    expect(res.status).toBe(202);
    const { jobId } = await res.json();
    const job = await createRepo(db as never).getJob(jobId);
    expect(job?.options).toMatchObject({ maskOn: true, sceneEmphasis: true });
    expect(job?.parentJobId).toBe(parent);
    expect(job?.input).toEqual(good);
    expect(started).toEqual([parent, jobId]);
  });

  it('body and scene reruns reuse the parent kit; a face rerun builds a new one', async () => {
    const parent = (await (await createJob(post('http://x/api/jobs', good))).json()).jobId;
    const repo = createRepo(db as never);
    const kit = { text: 'Face: round.', gender: 'male', ageBand: '18-29', build: 'average', refPaths: [`jobs/${parent}/in/user-0.jpg`] };
    await repo.saveKit(parent, kit);
    const body = (await (await rerun(post('http://x', { problem: 'body' }), ctx(parent))).json()).jobId;
    const face = (await (await rerun(post('http://x', { problem: 'face' }), ctx(parent))).json()).jobId;
    expect((await repo.getJob(body))?.input.kit).toEqual(kit);
    // "Face is wrong" can mean the words were wrong, so Gemini describes the person again.
    expect((await repo.getJob(face))?.input.kit).toBeUndefined();
  });
});
