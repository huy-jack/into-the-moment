'use client';

import { useEffect, useRef, useState } from 'react';
import { ApiError, getJob, type ApiJob } from '@/src/ui/api';

const NETWORK_RETRY_MS = 5000;

export type Seen = { stage: string; at: number };

/** `seen`: each stage this page saw, in order, with the time it first saw it (for the wait screen's stage list). */
export type JobState = { job: ApiJob | null; error: ApiError | null; seen: Seen[] };

/**
 * Polls one job at the pace the server asks for (pollAfterMs) and stops once it is done or failed.
 * `restart` changes start a fresh round of polling for the same job (after the code is entered again).
 */
export function useJob(jobId: string | null, restart: number, onError?: (e: ApiError) => void): JobState {
  const [state, setState] = useState<JobState & { forId: string | null }>({ forId: null, job: null, error: null, seen: [] });
  const onErrorRef = useRef(onError);
  useEffect(() => {
    onErrorRef.current = onError;
  });

  useEffect(() => {
    if (!jobId) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const tick = async () => {
      try {
        const job = await getJob(jobId);
        if (stopped) return;
        setState((s) => {
          const seen = s.forId === jobId ? s.seen : [];
          const changed = seen.at(-1)?.stage !== job.stage;
          return { forId: jobId, job, error: null, seen: changed ? [...seen, { stage: job.stage, at: Date.now() }] : seen };
        });
        if (job.pollAfterMs !== undefined) timer = setTimeout(tick, job.pollAfterMs);
      } catch (err) {
        if (stopped) return;
        const e = err as ApiError;
        setState((s) => ({ forId: jobId, job: s.forId === jobId ? s.job : null, error: e, seen: s.forId === jobId ? s.seen : [] }));
        onErrorRef.current?.(e);
        // A dropped connection is not the end of the job: keep asking.
        if (e.code === 'NETWORK') timer = setTimeout(tick, NETWORK_RETRY_MS);
      }
    };
    void tick();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [jobId, restart]);

  // State from an earlier job never shows under a new id.
  return state.forId === jobId ? { job: state.job, error: state.error, seen: state.seen } : { job: null, error: null, seen: [] };
}
