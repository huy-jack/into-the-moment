import { CHILD_AGE } from '../config';
import type { ModelId, Route } from '../types';

/** Child route when any person's estimated age range starts under CHILD_AGE. */
export function chooseRoute(ageLows: number[]): Route {
  return ageLows.some((a) => a < CHILD_AGE) ? 'child' : 'adult';
}

/**
 * Child route: GPT Image 2.5 first (2026-10-24: in a child-template test it accepted 12 of 12 child photos). OpenAI may
 * still refuse a child photo, so each refused version moves to Seedream 5.0 Lite. FLUX.2 dev is no longer used: it
 * kept the template child's body.
 */
export function modelsFor(
  route: Route,
  swapAdultOrder: boolean,
  hint?: { ageBand?: string; text?: string },
): { a: ModelId; b: ModelId; fallbacks: ModelId[] } {
  if (route === 'child') return { a: 'gpt-image-2.5-sunburst', b: 'gpt-image-2.5-flare', fallbacks: ['seedream-5-lite', 'seedream-5-lite'] };

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
