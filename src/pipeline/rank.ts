import { FACE_SMALL_RATIO, GEN_RETRIES_MAX } from '../config';
import type { Box, Candidate, JobOptions, Route } from '../types';

export function bodyPass(c: Candidate): boolean {
  const b = c.bodyCheck;
  return !!b && b.genderMatch && b.ageBandMatch && b.buildMatch && b.faceShapeMatch && !b.stillTemplatePerson;
}

/** Mean similarity over all refs; a ref with no matched face counts as 0. All missing gives null. */
export function meanScore(scores: (number | null)[]): number | null {
  if (scores.length === 0 || scores.every((s) => s === null)) return null;
  return scores.reduce<number>((sum, s) => sum + (s ?? 0), 0) / scores.length;
}

/** Images before refused/failed versions, body-check passes first, then face score high to low. Never drops a version. */
export function rankCandidates(cs: Candidate[]): Candidate[] {
  const key = (c: Candidate) => [c.path ? 1 : 0, bodyPass(c) ? 1 : 0, c.score ?? -1];
  return [...cs].sort((x, y) => {
    const a = key(x);
    const b = key(y);
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return b[i] - a[i];
    return 0;
  });
}

/** Adult route only: retry when the best version fails the body check or scores under T. */
export function needsRetry(route: Route, best: Candidate | undefined, t: number, retriesUsed: number): boolean {
  if (route !== 'adult' || retriesUsed >= GEN_RETRIES_MAX) return false;
  if (!best || !best.path) return true;
  return !bodyPass(best) || (best.score ?? 0) < t;
}

export function needsRepair(templateFaceBox: Box | null): boolean {
  return !!templateFaceBox && templateFaceBox.height < FACE_SMALL_RATIO;
}

export type Problem = 'face' | 'body' | 'scene';

export function optionsForProblem(problem: Problem, base: JobOptions): JobOptions {
  if (problem === 'face') return { ...base, swapAdultOrder: !base.swapAdultOrder };
  if (problem === 'body') return { ...base, strongBodyNote: true };
  return { ...base, maskOn: true, sceneEmphasis: true };
}
