import { needsRepair, needsRetry, rankCandidates } from '../pipeline/rank';
import type { Candidate } from '../types';
import { loadJob, stepAnalyze, stepEvaluate, stepFail, stepFinalize, stepGenerate, stepPrepare, stepRepair } from './steps';

/**
 * One swap job as a durable workflow. Same decisions as the in-process runSwap: 2 versions in
 * parallel, a fallback on refusal when the route lists one (none today), 1 retry of A on the adult route, face repair on
 * small faces. Before any version exists, a step that ends the job has already written it as
 * failed and the workflow stops. After that, every exit finalizes with the versions already
 * paid for: the user always sees every version.
 */
export async function swapWorkflow(jobId: string) {
  'use workflow';
  let all: Candidate[] = [];
  const stop = () => (all.length ? stepFinalize(jobId, all) : undefined);
  try {
    const { input, faceT } = await loadJob(jobId);
    const prep = await stepPrepare(input);
    if (!prep.ok) return;
    const an = await stepAnalyze(input, prep.value);
    if (!an.ok) return;
    const ctx = [input, prep.value, an.value] as const;
    const { a, b, fallbacks } = an.value.models;

    const first = await Promise.all([stepGenerate(...ctx, 'a', a, 1), stepGenerate(...ctx, 'b', b, 1)]);
    all = first.flatMap((g) => (g.ok ? [g.value] : []));
    if (first.some((g) => !g.ok)) return await stop();
    let versions = [...all];

    const queue = [...fallbacks];
    const refused = versions.filter((v) => v.refused);
    for (const v of refused) {
      const next = queue.shift();
      if (!next) break;
      const g = await stepGenerate(...ctx, v.slot, next, 2);
      if (!g.ok) return await stop();
      versions = [...versions, g.value];
      all = [...versions];
    }

    const evaluated = await Promise.all(versions.map((v) => stepEvaluate(...ctx, v)));
    all = evaluated.map((e, i) => (e.ok ? e.value : versions[i]));

    if (needsRetry(an.value.route, rankCandidates(all)[0], faceT, 0)) {
      const g = await stepGenerate(...ctx, 'retry', a, 1);
      if (!g.ok) return await stop();
      const e = await stepEvaluate(...ctx, g.value);
      all = [...all, e.ok ? e.value : g.value];
    }

    const best = rankCandidates(all)[0];
    if (needsRepair(prep.value.template.faceBox) && best?.path) {
      const r = await stepRepair(...ctx, best);
      if (!r.ok) return await stop();
      const e = await stepEvaluate(...ctx, r.value);
      all = [...all, e.ok ? e.value : r.value];
    }

    await stepFinalize(jobId, all);
  } catch (err) {
    if (all.length) await stepFinalize(jobId, all);
    else await stepFail(jobId, err instanceof Error ? err.message : String(err));
  }
}
