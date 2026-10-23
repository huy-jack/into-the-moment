import { describe, expect, it } from 'vitest';
import { runPairs } from '@/scripts/lib/runPairs';
import { makeFakes } from '../helpers/fakes';

describe('runPairs', () => {
  it('runs each pair and collects versions and costs', async () => {
    const f = await makeFakes();
    const pairs = [
      { id: 'p1', case: '1', template: 'uploads/template.jpg', users: ['uploads/u1.jpg'] },
      { id: 'p2', case: '2-mf', template: 'uploads/template.jpg', users: ['uploads/u2.jpg'] },
    ];
    const out = await runPairs(pairs, f.deps, { quality: 'high' });
    expect(out.stoppedBySpend).toBe(false);
    expect(out.pairs.map((p) => p.id)).toEqual(['p1', 'p2']);
    expect(out.pairs[0].candidates.length).toBeGreaterThanOrEqual(2);
    expect(out.pairs[0].costs.every((c) => c.jobId === 'p1')).toBe(true);
  });

  it('stops at the spend limit and marks the pair', async () => {
    const f = await makeFakes({ spendCapUsd: 0.2 });
    const pairs = [
      { id: 'p1', case: '1', template: 'uploads/template.jpg', users: ['uploads/u1.jpg'] },
      { id: 'p2', case: '1', template: 'uploads/template.jpg', users: ['uploads/u1.jpg'] },
    ];
    const out = await runPairs(pairs, f.deps, { quality: 'high' });
    expect(out.stoppedBySpend).toBe(true);
    expect(out.pairs).toHaveLength(1);
    expect(out.pairs[0].error).toBe('SPEND_CAP');
  });
});
