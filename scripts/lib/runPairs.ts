import { FatalError, SpendCapError } from '../../src/errors';
import type { Deps } from '../../src/pipeline/deps';
import { runSwap } from '../../src/pipeline/runSwap';
import { DEFAULT_OPTIONS, type JobOptions, type Quality, type StepCost } from '../../src/types';
import type { PairResult } from './report';

export type Pair = { id: string; case: string; template: string; users: string[]; options?: Partial<JobOptions> };

/** Runs pairs one by one with the in-process pipeline. Stops at the first spend-cap hit. */
export async function runPairs(
  pairs: Pair[],
  deps: Deps,
  settings: { quality: Quality },
): Promise<{ pairs: PairResult[]; stoppedBySpend: boolean }> {
  const results: PairResult[] = [];
  const ledger = deps.ledger as { all?: () => Promise<StepCost[]> };
  const costsFor = async (id: string) => ((await ledger.all?.()) ?? []).filter((c) => c.jobId === id);

  for (const pair of pairs) {
    const started = Date.now();
    const options: JobOptions = { ...DEFAULT_OPTIONS, quality: settings.quality, ...pair.options };
    const base = { id: pair.id, case: pair.case, templatePath: pair.template, userPaths: pair.users };
    try {
      const out = await runSwap(deps, { jobId: pair.id, templatePath: pair.template, userPaths: pair.users, options });
      const capHit = out.result.ranked.some((c) => c.error === 'SPEND_CAP');
      results.push({
        ...base,
        route: out.analysis.route,
        error: out.result.status === 'failed' ? out.result.code : capHit ? 'SPEND_CAP' : null,
        ms: Date.now() - started,
        candidates: out.result.ranked,
        costs: await costsFor(pair.id),
      });
      if (capHit) return { pairs: results, stoppedBySpend: true };
    } catch (err) {
      const code = err instanceof SpendCapError ? 'SPEND_CAP' : err instanceof FatalError ? err.code : String(err);
      results.push({ ...base, route: null, error: code, ms: Date.now() - started, candidates: [], costs: await costsFor(pair.id) });
      if (err instanceof SpendCapError) return { pairs: results, stoppedBySpend: true };
    }
  }
  return { pairs: results, stoppedBySpend: false };
}
