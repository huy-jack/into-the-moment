import { describe, expect, it } from 'vitest';
import { suggestThreshold } from '@/scripts/lib/calibrate';
import { renderReport, type HarnessRun } from '@/scripts/lib/report';

describe('suggestThreshold', () => {
  it('takes the midpoint when same and different scores do not overlap', () => {
    expect(suggestThreshold([92, 95], [20, 40])).toEqual({ t: 66, minSame: 92, maxDiff: 40, overlap: false });
  });
  it('uses the highest different-person score when they overlap', () => {
    expect(suggestThreshold([60, 95], [70])).toEqual({ t: 70, minSame: 60, maxDiff: 70, overlap: true });
  });
});

const run: HarnessRun = {
  startedAt: '2026-10-20T10:00:00Z',
  mode: 'replay',
  settings: { quality: 'high' },
  pairs: [
    {
      id: 'c3-ac',
      case: '3-ac',
      templatePath: 'store/uploads/c3-ac/template.jpg',
      userPaths: ['store/uploads/c3-ac/u0.jpg'],
      route: 'child',
      error: null,
      ms: 41000,
      candidates: [
        { slot: 'a', model: 'seedream-5-lite', attempt: 1, path: null, refused: true, refusalText: 'blocked: minor', failed: false, bodyCheck: null, score: null },
        { slot: 'b', model: 'flux-2-dev', attempt: 1, path: 'store/jobs/c3-ac/b-1.png', refused: false, refusalText: null, failed: false, bodyCheck: { genderMatch: true, ageBandMatch: true, buildMatch: true, faceShapeMatch: true, stillTemplatePerson: false, reasons: '' }, score: 71.5 },
      ],
      costs: [
        { jobId: 'c3-ac', step: 'generate-a', attempt: 1, provider: 'seedream-5-lite', usd: 0.08, ms: 20000 },
        { jobId: 'c3-ac', step: 'generate-b', attempt: 1, provider: 'flux-2-dev', usd: 0.075, ms: 18000 },
      ],
    },
  ],
};

describe('renderReport', () => {
  it('lists every version including refused ones', () => {
    const md = renderReport(run);
    expect(md).toContain('seedream-5-lite');
    expect(md).toContain('flux-2-dev');
    expect(md).toContain('blocked: minor');
    expect(md).toContain('71.5');
  });
  it('total cost equals the sum of cost rows', () => {
    expect(renderReport(run)).toContain('$0.155');
  });
});
