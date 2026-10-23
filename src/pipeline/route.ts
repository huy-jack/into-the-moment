import { CHILD_AGE } from '../config';
import type { ModelId, Route } from '../types';

/** Child route when any person's estimated age range starts under CHILD_AGE. */
export function chooseRoute(ageLows: number[]): Route {
  return ageLows.some((a) => a < CHILD_AGE) ? 'child' : 'adult';
}

/**
 * OpenAI and Google block edits of realistic photos of children by written rule, so the
 * child route never contains a GPT Image or Nano Banana model. No fallbacks: a refused child
 * version stays refused.
 */
export function modelsFor(
  route: Route,
  swapAdultOrder: boolean,
  hint?: { ageBand?: string; text?: string },
): { a: ModelId; b: ModelId; fallbacks: ModelId[] } {
  if (route === 'child') return { a: 'seedream-5-lite', b: 'flux-2-dev', fallbacks: [] };

  // Older faces and strong jaws go to Sunburst first; Flare leads otherwise and runs faster.
  const preferSunburst =
    hint?.ageBand === 'elderly' ||
    hint?.ageBand === 'middle' ||
    /square jaw|wide jaw|bearded|elderly|wrinkles|grey hair/i.test(hint?.text ?? '');

  const effectiveSwap = swapAdultOrder ? !preferSunburst : preferSunburst;

  return effectiveSwap
    ? { a: 'gpt-image-2.5-sunburst', b: 'gpt-image-2.5-flare', fallbacks: [] }
    : { a: 'gpt-image-2.5-flare', b: 'gpt-image-2.5-sunburst', fallbacks: [] };
}
