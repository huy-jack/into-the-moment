export type PolledJob = { status: string; stage: string; pollAfterMs?: number };

/** Polls a job by its own pollAfterMs hint until done or failed, recording each new stage once. */
export async function pollUntilDone<J extends PolledJob>(
  get: () => Promise<J>,
  sleep: (ms: number) => Promise<void>,
  now: () => number,
  limitMs: number,
): Promise<{ job: J; stages: string[] }> {
  const started = now();
  const stages: string[] = [];
  for (;;) {
    const job = await get();
    if (stages[stages.length - 1] !== job.stage) stages.push(job.stage);
    if (job.status === 'done' || job.status === 'failed') return { job, stages };
    if (now() - started >= limitMs) throw new Error(`job still running after ${Math.round(limitMs / 1000)} s`);
    await sleep(job.pollAfterMs ?? 2000);
  }
}
