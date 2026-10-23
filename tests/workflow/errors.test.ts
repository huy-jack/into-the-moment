import { describe, expect, it } from 'vitest';
import { FatalError, RateLimitError, RefusalError, SpendCapError, TimeoutError } from '@/src/errors';
import { isFinalAttempt, toRunnerAction } from '@/src/workflow/errors';

describe('toRunnerAction', () => {
  it('a refusal ends the job without a runner retry', () => {
    expect(toRunnerAction(new RefusalError('blocked'))).toEqual({ kind: 'fail', code: 'REFUSED_ALL' });
  });
  it('a pipeline FatalError ends the job with its code', () => {
    expect(toRunnerAction(new FatalError('NO_PERSON'))).toEqual({ kind: 'fail', code: 'NO_PERSON' });
  });
  it('the spend cap ends the job', () => {
    expect(toRunnerAction(new SpendCapError())).toEqual({ kind: 'fail', code: 'SPEND_CAP' });
  });
  it('a timeout ends the job: retrying a 250 s call would pass the step limit again', () => {
    expect(toRunnerAction(new TimeoutError())).toEqual({ kind: 'fail', code: 'TIMEOUT' });
  });
  it('a rate limit retries after the provider delay', () => {
    expect(toRunnerAction(new RateLimitError(12_000))).toEqual({ kind: 'retry', afterMs: 12_000 });
  });
  it('an unknown error is left to the runner retry', () => {
    expect(toRunnerAction(new Error('socket hang up'))).toEqual({ kind: 'rethrow' });
  });
});

describe('isFinalAttempt', () => {
  it('with maxRetries 1, attempt 1 may retry and attempt 2 is the last', () => {
    expect(isFinalAttempt(1, 1)).toBe(false);
    expect(isFinalAttempt(2, 1)).toBe(true);
  });
});
