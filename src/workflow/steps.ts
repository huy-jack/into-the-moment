import { getStepMetadata, RetryableError } from 'workflow';
import { getDb } from '../db/client';
import { createRepo } from '../db/repo';
import { userMessage } from '../errors';
import * as pipeline from '../pipeline/steps';
import type { Analysis, Prepared } from '../pipeline/steps';
import { faceT, serverDeps } from '../server/serverDeps';
import type { Candidate, JobInput, ModelId, Slot } from '../types';
import { isFinalAttempt, toRunnerAction } from './errors';

// Each function is one durable step: its own function call, its own 300 s, results saved by the
// runner. Inputs and outputs are plain JSON (paths and scores, never image bytes).

export type Guarded<T> = { ok: true; value: T } | { ok: false };

const repo = () => createRepo(getDb());

async function guard<T>(jobId: string, stage: string, fn: () => Promise<T>): Promise<Guarded<T>> {
  await repo().setStage(jobId, stage, 'running');
  try {
    return { ok: true, value: await fn() };
  } catch (err) {
    const action = toRunnerAction(err);
    if (action.kind === 'fail') {
      await repo().setStage(jobId, 'failed', 'failed', { code: action.code, message: userMessage(action.code) });
      return { ok: false };
    }
    if (action.kind === 'retry') throw new RetryableError((err as Error).message, { retryAfter: action.afterMs });
    throw err;
  }
}

export async function loadJob(jobId: string): Promise<{ input: JobInput; faceT: number }> {
  'use step';
  const job = await repo().getJob(jobId);
  if (!job) throw new Error(`job ${jobId} not found`);
  return {
    input: { jobId, templatePath: job.input.templatePath, userPaths: job.input.userPaths, options: job.options, kit: job.input.kit },
    faceT: faceT(),
  };
}

export async function stepPrepare(input: JobInput): Promise<Guarded<Prepared>> {
  'use step';
  return guard(input.jobId, 'checking_photos', () => pipeline.prepareInputs(serverDeps(), input));
}

export async function stepAnalyze(input: JobInput, prep: Prepared): Promise<Guarded<Analysis>> {
  'use step';
  return guard(input.jobId, 'reading_scene', async () => {
    const an = await pipeline.analyze(serverDeps(), input, prep);
    await repo().setStage(input.jobId, 'reading_scene', 'running', undefined, an.route);
    if (!input.kit) await repo().saveKit(input.jobId, an.kit);
    return an;
  });
}

export async function stepGenerate(
  input: JobInput,
  prep: Prepared,
  an: Analysis,
  slot: Slot,
  model: ModelId,
  attempt: number,
): Promise<Guarded<Candidate>> {
  'use step';
  try {
    return await guard(input.jobId, 'making_versions', () =>
      pipeline.generateVersion(serverDeps(), input, prep, an, slot, model, attempt),
    );
  } catch (err) {
    // Same rule as the in-process run: after the last retry the version fails, the job goes on.
    if (!isFinalAttempt(getStepMetadata().attempt, GENERATE_MAX_RETRIES)) throw err;
    console.log(`${slot}-${attempt} ${model} failed after retries: ${(err as Error).message}`);
    return { ok: true, value: failedCandidate(slot, model, attempt) };
  }
}
// Spec: a generation step retries once at most.
const GENERATE_MAX_RETRIES = 1;
stepGenerate.maxRetries = GENERATE_MAX_RETRIES;

const failedCandidate = (slot: Slot, model: ModelId, attempt: number): Candidate => ({
  slot,
  model,
  attempt,
  path: null,
  refused: false,
  refusalText: null,
  failed: true,
  bodyCheck: null,
  score: null,
  error: 'PROVIDER_ERROR',
});

export async function stepEvaluate(input: JobInput, prep: Prepared, an: Analysis, c: Candidate): Promise<Guarded<Candidate>> {
  'use step';
  return guard(input.jobId, 'checking_likeness', () => pipeline.evaluate(serverDeps(), input, prep, an, c));
}

export async function stepRepair(input: JobInput, prep: Prepared, an: Analysis, best: Candidate): Promise<Guarded<Candidate>> {
  'use step';
  return guard(input.jobId, 'fixing_face', () => pipeline.repair(serverDeps(), input, prep, an, best));
}
stepRepair.maxRetries = 1;

export async function stepFinalize(jobId: string, cs: Candidate[]): Promise<void> {
  'use step';
  const result = pipeline.finalize(cs);
  await repo().saveCandidates(jobId, result.ranked);
  if (result.status === 'done') await repo().setStage(jobId, 'done', 'done');
  else await repo().setStage(jobId, 'failed', 'failed', { code: result.code, message: userMessage(result.code) });
}

export async function stepFail(jobId: string, message: string): Promise<void> {
  'use step';
  await repo().setStage(jobId, 'failed', 'failed', { code: 'PROVIDER_ERROR', message: `${userMessage('PROVIDER_ERROR')} (${message})` });
}
