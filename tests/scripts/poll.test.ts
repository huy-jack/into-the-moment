import { describe, expect, it } from 'vitest';
import { pollUntilDone } from '@/scripts/lib/poll';

describe('pollUntilDone', () => {
  it('follows pollAfterMs, records each new stage once, and stops when done', async () => {
    const answers = [
      { status: 'running', stage: 'checking_photos', pollAfterMs: 2000 },
      { status: 'running', stage: 'checking_photos', pollAfterMs: 2000 },
      { status: 'running', stage: 'making_versions', pollAfterMs: 5000 },
      { status: 'done', stage: 'done' },
    ];
    const waits: number[] = [];
    let clock = 0;
    const out = await pollUntilDone(
      async () => answers.shift()!,
      async (ms) => {
        waits.push(ms);
        clock += ms;
      },
      () => clock,
      600_000,
    );
    expect(out.job.status).toBe('done');
    expect(out.stages).toEqual(['checking_photos', 'making_versions', 'done']);
    expect(waits).toEqual([2000, 2000, 5000]);
  });

  it('gives up after the time limit', async () => {
    let clock = 0;
    await expect(
      pollUntilDone(
        async () => ({ status: 'running', stage: 'making_versions', pollAfterMs: 5000 }),
        async (ms) => {
          clock += ms;
        },
        () => clock,
        12_000,
      ),
    ).rejects.toThrow(/still running after 12 s/);
  });
});
