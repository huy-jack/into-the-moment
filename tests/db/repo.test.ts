import { PGlite } from '@electric-sql/pglite';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { beforeEach, describe, expect, it } from 'vitest';
import { checkCaps, createRepo, type Repo } from '@/src/db/repo';
import * as schema from '@/src/db/schema';
import { createDbLedger } from '@/src/ledger/dbLedger';
import { DEFAULT_OPTIONS, type Candidate, type JobInput } from '@/src/types';

let db: ReturnType<typeof drizzle<typeof schema>>;
let repo: Repo;

beforeEach(async () => {
  db = drizzle(new PGlite(), { schema });
  await migrate(db, { migrationsFolder: 'drizzle' });
  repo = createRepo(db as never);
});

const input = (jobId: string): JobInput => ({
  jobId,
  templatePath: 'uploads/t.jpg',
  userPaths: ['uploads/u1.jpg', 'uploads/u2.jpg'],
  options: DEFAULT_OPTIONS,
});

const cand = (slot: Candidate['slot'], score: number): Candidate => ({
  slot,
  model: 'gpt-image-2.5-flare',
  attempt: 1,
  path: `jobs/j1/${slot}-1.png`,
  refused: false,
  refusalText: null,
  failed: false,
  bodyCheck: { genderMatch: true, ageBandMatch: true, buildMatch: true, faceShapeMatch: true, stillTemplatePerson: false, reasons: '' },
  score,
});

const minutesAgo = (now: Date, m: number) => new Date(now.getTime() - m * 60_000);

describe('repo', () => {
  it('job round trip keeps the ranked order', async () => {
    await repo.createJob(input('j1'));
    await repo.setStage('j1', 'making_versions', 'running');
    await repo.saveCandidates('j1', [cand('b', 91), cand('a', 70)]);
    const job = await repo.getJob('j1');
    expect(job?.status).toBe('running');
    expect(job?.stage).toBe('making_versions');
    expect(job?.candidates.map((c) => c.slot)).toEqual(['b', 'a']);
    expect(job?.options).toEqual(DEFAULT_OPTIONS);
    expect(job?.input.userPaths).toEqual(['uploads/u1.jpg', 'uploads/u2.jpg']);
  });

  it('saveKit stores the identity kit with the job input', async () => {
    await repo.createJob(input('j1'));
    const kit = { text: 'Face: round.', gender: 'male', ageBand: '18-29', build: 'average', refPaths: ['jobs/j1/in/user-0.jpg'] };
    await repo.saveKit('j1', kit);
    const job = await repo.getJob('j1');
    expect(job?.input.kit).toEqual(kit);
    expect(job?.input.userPaths).toEqual(['uploads/u1.jpg', 'uploads/u2.jpg']);
  });

  it('a reservation counts against the cap at once, and a replay of the same step is "exists"', async () => {
    const ledger = createDbLedger(db as never);
    const key = { jobId: 'j1', step: 'generate-a', attempt: 1, provider: 'gpt-image-2.5-flare', estimateUsd: 0.25 };
    expect(await ledger.reserve(key, 10)).toBe('reserved');
    expect(await ledger.total()).toBeCloseTo(0.25, 5);
    expect(await ledger.reserve(key, 10)).toBe('exists');
    await ledger.settle('j1', 'generate-a', 1, 0.2, 1500);
    expect(await ledger.total()).toBeCloseTo(0.2, 5);
  });

  it('a reservation past the cap is refused and writes nothing', async () => {
    const ledger = createDbLedger(db as never);
    expect(await ledger.reserve({ jobId: 'j1', step: 's', attempt: 1, provider: 'p', estimateUsd: 0.15 }, 0.2)).toBe('reserved');
    expect(await ledger.reserve({ jobId: 'j1', step: 't', attempt: 1, provider: 'p', estimateUsd: 0.15 }, 0.2)).toBe('over_cap');
    expect(await ledger.total()).toBeCloseTo(0.15, 5);
  });

  it('two parallel reservations cannot both pass the cap', async () => {
    const ledger = createDbLedger(db as never);
    const r = await Promise.all([
      ledger.reserve({ jobId: 'j1', step: 'a', attempt: 1, provider: 'p', estimateUsd: 0.15 }, 0.2),
      ledger.reserve({ jobId: 'j1', step: 'b', attempt: 1, provider: 'p', estimateUsd: 0.15 }, 0.2),
    ]);
    expect(r.sort()).toEqual(['over_cap', 'reserved']);
  });

  it('JOB_CAP at 20 jobs in the last hour, ok at 19', async () => {
    const now = new Date();
    const ledger = createDbLedger(db as never);
    for (let i = 0; i < 19; i++) await repo.createJob(input(`j${i}`));
    expect(await checkCaps(repo, ledger, now, 10)).toEqual({ ok: true });
    await repo.createJob(input('j19'));
    expect(await checkCaps(repo, ledger, now, 10)).toEqual({ ok: false, code: 'JOB_CAP' });
  });

  it('UPLOAD_CAP at 1500 uploads this month', async () => {
    const now = new Date();
    const ledger = createDbLedger(db as never);
    await repo.createJob(input('j1'));
    await db.insert(schema.photos).values(
      Array.from({ length: 1497 }, (_, i) => ({ jobId: 'j1', kind: 'user', blobPath: `uploads/x${i}.jpg` })),
    );
    // 1497 + 3 photos of j1 = 1500
    expect(await repo.uploadsThisMonth(now)).toBe(1500);
    expect(await checkCaps(repo, ledger, now, 10)).toEqual({ ok: false, code: 'UPLOAD_CAP' });
  });

  it('SPEND_CAP when the ledger total reaches the cap', async () => {
    const ledger = createDbLedger(db as never);
    await ledger.reserve({ jobId: 'x', step: 's', attempt: 1, provider: 'p', estimateUsd: 10 }, 100);
    expect(await checkCaps(repo, ledger, new Date(), 10)).toEqual({ ok: false, code: 'SPEND_CAP' });
  });

  it('markStuck fails a job updated 11 minutes ago and leaves one updated 9 minutes ago', async () => {
    const now = new Date();
    await repo.createJob(input('old'));
    await repo.createJob(input('fresh'));
    await repo.setStage('old', 'making_versions', 'running');
    await repo.setStage('fresh', 'making_versions', 'running');
    await db.update(schema.jobs).set({ updatedAt: minutesAgo(now, 11) }).where(eq(schema.jobs.id, 'old'));
    await db.update(schema.jobs).set({ updatedAt: minutesAgo(now, 9) }).where(eq(schema.jobs.id, 'fresh'));
    expect(await repo.markStuck(now)).toBe(1);
    expect((await repo.getJob('old'))?.error?.code).toBe('STUCK');
    expect((await repo.getJob('fresh'))?.status).toBe('running');
  });
});
