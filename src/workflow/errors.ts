import { FatalError, RateLimitError, RefusalError, SpendCapError, TimeoutError, type ErrorCode } from '../errors';

export type RunnerAction = { kind: 'fail'; code: ErrorCode } | { kind: 'retry'; afterMs: number } | { kind: 'rethrow' };

/**
 * What the job runner does with an error thrown inside a step.
 * fail: write the job as failed and stop (no runner retry). retry: retry after the delay.
 * rethrow: an unknown error, left to the runner's own retry count.
 */
export function toRunnerAction(err: unknown): RunnerAction {
  if (err instanceof RefusalError) return { kind: 'fail', code: 'REFUSED_ALL' };
  if (err instanceof FatalError) return { kind: 'fail', code: err.code };
  if (err instanceof SpendCapError) return { kind: 'fail', code: 'SPEND_CAP' };
  if (err instanceof TimeoutError) return { kind: 'fail', code: 'TIMEOUT' };
  if (err instanceof RateLimitError) return { kind: 'retry', afterMs: err.retryAfterMs };
  return { kind: 'rethrow' };
}

/** Attempts count from 1. With maxRetries N there are N + 1 attempts. */
export function isFinalAttempt(attempt: number, maxRetries: number): boolean {
  return attempt >= maxRetries + 1;
}
