import { POLL_FAST_MS, POLL_SLOW_AFTER_MS, POLL_SLOW_MS, SIGNED_URL_TTL_S } from '../config';
import type { JobView } from '../db/repo';

type Signer = { signedUrl(path: string, ttlS: number): Promise<string> };

export function pollAfterMs(job: Pick<JobView, 'status' | 'createdAt'>, now: Date): number | undefined {
  if (job.status === 'done' || job.status === 'failed') return undefined;
  return now.getTime() - job.createdAt.getTime() < POLL_SLOW_AFTER_MS ? POLL_FAST_MS : POLL_SLOW_MS;
}

/**
 * API shape of a job: signed links instead of storage paths. Links are signed only once the job
 * is finished: each link costs Blob API calls, and a running job is polled up to 100 times.
 */
export async function toApiJob(job: JobView, store: Signer, now: Date) {
  const finished = job.status === 'done' || job.status === 'failed';
  const sign = (p: string) => store.signedUrl(p, SIGNED_URL_TTL_S);
  return {
    id: job.id,
    status: job.status,
    stage: job.stage,
    route: job.route,
    error: job.error,
    parentJobId: job.parentJobId,
    inputs: finished
      ? { template: await sign(job.input.templatePath), users: await Promise.all(job.input.userPaths.map(sign)) }
      : null,
    candidates: await Promise.all(
      job.candidates.map(async ({ path, ...c }) => ({ ...c, url: path && finished ? await sign(path) : null })),
    ),
    pollAfterMs: pollAfterMs(job, now),
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
  };
}
