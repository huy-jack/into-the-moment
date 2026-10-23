import { and, asc, count, eq, gte, isNotNull, lt, sql } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { JOB_CAP_PER_HOUR, STUCK_AFTER_MS, UPLOAD_CAP_PER_MONTH } from '../config';
import { userMessage, type ErrorCode } from '../errors';
import type { CostLedger } from '../pipeline/deps';
import type { Candidate, IdentityKit, JobInput, JobOptions, ModelId, Route, Slot } from '../types';
import * as schema from './schema';

export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

export type JobStatus = 'queued' | 'running' | 'done' | 'failed';

export type JobView = {
  id: string;
  status: JobStatus;
  stage: string;
  route: Route | null;
  error: { code: ErrorCode; message: string } | null;
  candidates: Candidate[];
  input: { templatePath: string; userPaths: string[]; kit?: IdentityKit };
  options: JobOptions;
  parentJobId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

const monthStart = (now: Date) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

export function createRepo(db: Db) {
  return {
    async createJob(input: JobInput, parentJobId?: string, problem?: string): Promise<void> {
      await db.insert(schema.jobs).values({
        id: input.jobId,
        input: { templatePath: input.templatePath, userPaths: input.userPaths, ...(input.kit ? { kit: input.kit } : {}) },
        options: input.options,
        parentJobId: parentJobId ?? null,
        problem: problem ?? null,
      });
      // Count every upload against the monthly Blob cap.
      await db.insert(schema.photos).values([
        { jobId: input.jobId, kind: 'template', blobPath: input.templatePath },
        ...input.userPaths.map((p) => ({ jobId: input.jobId, kind: 'user', blobPath: p })),
      ]);
    },

    async setStage(
      jobId: string,
      stage: string,
      status?: JobStatus,
      error?: { code: ErrorCode; message: string },
      route?: Route,
    ): Promise<void> {
      await db
        .update(schema.jobs)
        .set({
          stage,
          ...(status ? { status } : {}),
          ...(error ? { errorCode: error.code, errorMessage: error.message } : {}),
          // A finished job carries no old error (for example STUCK from a late step).
          ...(status === 'done' ? { errorCode: null, errorMessage: null } : {}),
          ...(route ? { route } : {}),
          updatedAt: new Date(),
        })
        .where(eq(schema.jobs.id, jobId));
    },

    /** Keeps the identity kit with the job, so a rerun can reuse the same words. */
    async saveKit(jobId: string, kit: IdentityKit): Promise<void> {
      await db
        .update(schema.jobs)
        .set({ input: sql`${schema.jobs.input} || ${JSON.stringify({ kit })}::jsonb` })
        .where(eq(schema.jobs.id, jobId));
    },

    /** Replaces the job's versions, keeping the given rank order. */
    async saveCandidates(jobId: string, cs: Candidate[]): Promise<void> {
      await db.delete(schema.candidates).where(eq(schema.candidates.jobId, jobId));
      if (cs.length === 0) return;
      await db.insert(schema.candidates).values(
        cs.map((c, rank) => ({
          jobId,
          slot: c.slot,
          model: c.model,
          attempt: c.attempt,
          blobPath: c.path,
          identityScore: c.score,
          bodyCheck: c.bodyCheck,
          repaired: c.slot === 'repair',
          refused: c.refused,
          refusalText: c.refusalText,
          failed: c.failed,
          rank,
        })),
      );
    },

    async getJob(jobId: string): Promise<JobView | null> {
      const [job] = await db.select().from(schema.jobs).where(eq(schema.jobs.id, jobId));
      if (!job) return null;
      const rows = await db
        .select()
        .from(schema.candidates)
        .where(eq(schema.candidates.jobId, jobId))
        .orderBy(asc(schema.candidates.rank));
      return {
        id: job.id,
        status: job.status as JobStatus,
        stage: job.stage,
        route: (job.route as Route | null) ?? null,
        error: job.errorCode ? { code: job.errorCode as ErrorCode, message: job.errorMessage ?? '' } : null,
        candidates: rows.map((r) => ({
          slot: r.slot as Slot,
          model: r.model as ModelId,
          attempt: r.attempt,
          path: r.blobPath,
          refused: r.refused,
          refusalText: r.refusalText,
          failed: r.failed,
          bodyCheck: r.bodyCheck ?? null,
          score: r.identityScore,
        })),
        input: job.input,
        options: job.options,
        parentJobId: job.parentJobId,
        createdAt: job.createdAt,
        updatedAt: job.updatedAt,
      };
    },

    async jobsInLastHour(now: Date): Promise<number> {
      const [r] = await db
        .select({ n: count() })
        .from(schema.jobs)
        .where(gte(schema.jobs.createdAt, new Date(now.getTime() - 3_600_000)));
      return Number(r.n);
    },

    /** Photos plus generated images this month: both are Blob uploads. */
    async uploadsThisMonth(now: Date): Promise<number> {
      const since = monthStart(now);
      const [p] = await db.select({ n: count() }).from(schema.photos).where(gte(schema.photos.createdAt, since));
      const [c] = await db
        .select({ n: count() })
        .from(schema.candidates)
        .where(and(gte(schema.candidates.createdAt, since), isNotNull(schema.candidates.blobPath)));
      return Number(p.n) + Number(c.n);
    },

    /** Running jobs with no update for STUCK_AFTER_MS become failed with STUCK. */
    async markStuck(now: Date): Promise<number> {
      const rows = await db
        .update(schema.jobs)
        .set({ status: 'failed', errorCode: 'STUCK', errorMessage: userMessage('STUCK'), updatedAt: now })
        .where(
          and(
            sql`${schema.jobs.status} in ('queued', 'running')`,
            lt(schema.jobs.updatedAt, new Date(now.getTime() - STUCK_AFTER_MS)),
          ),
        )
        .returning({ id: schema.jobs.id });
      return rows.length;
    },
  };
}

export type Repo = ReturnType<typeof createRepo>;

export async function checkCaps(
  repo: Repo,
  ledger: CostLedger,
  now: Date,
  spendCapUsd: number,
): Promise<{ ok: true } | { ok: false; code: 'JOB_CAP' | 'UPLOAD_CAP' | 'SPEND_CAP' }> {
  if ((await ledger.total()) >= spendCapUsd) return { ok: false, code: 'SPEND_CAP' };
  if ((await repo.uploadsThisMonth(now)) >= UPLOAD_CAP_PER_MONTH) return { ok: false, code: 'UPLOAD_CAP' };
  if ((await repo.jobsInLastHour(now)) >= JOB_CAP_PER_HOUR) return { ok: false, code: 'JOB_CAP' };
  return { ok: true };
}
