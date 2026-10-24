import { RateLimitError } from '../errors';
import type { Candidate, JobInput, ModelId, Slot, StepCost } from '../types';
import type { Deps } from './deps';
import { needsRepair, needsRetry, rankCandidates } from './rank';
import { analyze, evaluate, finalize, generateVersion, prepareInputs, repair, type Analysis, type Final, type Prepared } from './steps';

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** In-process orchestrator for the B1 test script. The server runs the same steps in a workflow. */
export async function runSwap(
  deps: Deps,
  input: JobInput,
): Promise<{ prep: Prepared; analysis: Analysis; result: Final; costs: StepCost[] }> {
  const sleep = deps.sleep ?? defaultSleep;
  const prep = await prepareInputs(deps, input);
  const an = await analyze(deps, input, prep);

  // A rate limit waits once; a second one marks the version failed.
  const gen = async (slot: Slot, model: ModelId, attempt: number): Promise<Candidate> => {
    try {
      return await generateVersion(deps, input, prep, an, slot, model, attempt);
    } catch (err) {
      if (!(err instanceof RateLimitError)) throw err;
      await sleep(err.retryAfterMs);
      try {
        return await generateVersion(deps, input, prep, an, slot, model, attempt);
      } catch (again) {
        if (!(again instanceof RateLimitError)) throw again;
        return { slot, model, attempt, path: null, refused: false, refusalText: null, failed: true, bodyCheck: null, score: null };
      }
    }
  };

  const { a, b, fallbacks } = an.models;
  let versions: Candidate[] = await Promise.all([gen('a', a, 1), gen('b', b, 1)]);

  // Child route: each refused version moves to the next model in the list. The refused one
  // stays in the list, because no version is ever hidden.
  const queue = [...fallbacks];
  const retried = await Promise.all(
    versions.filter((v) => v.refused).map((v) => (queue.length ? gen(v.slot, queue.shift()!, 2) : null)),
  );
  versions = [...versions, ...retried.filter((r): r is Candidate => r !== null)];

  let all = await Promise.all(versions.map((v) => evaluate(deps, input, prep, an, v)));

  if (needsRetry(an.route, rankCandidates(all)[0], deps.faceT, 0)) {
    all.push(await evaluate(deps, input, prep, an, await gen('retry', a, 1)));
  }

  const best = rankCandidates(all)[0];
  // Same switch as the server workflow: face repair is off unless ENABLE_FACE_REPAIR=true.
  if (process.env.ENABLE_FACE_REPAIR === 'true' && needsRepair(prep.template.faceBox) && best?.path) {
    all = [...all, await evaluate(deps, input, prep, an, await repair(deps, input, prep, an, best))];
  }

  const ledger = deps.ledger as { all?: () => Promise<StepCost[]> };
  const costs = (await ledger.all?.()) ?? [];
  return { prep, analysis: an, result: finalize(all), costs };
}
