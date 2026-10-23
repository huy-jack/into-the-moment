import type { ModelId, Quality } from '../types';

export const REKOGNITION_USD = 0.001;
export const GEMINI_USD = 0.001;

// MachGen gross price per GPT Image 2.5 swap, measured at 1280x848 STANDARD (2026-10-21).
// The provider snaps every request to a listed size of 1.64 MP or less; the other sizes and EXPRESS are not
// measured, so they reserve the same.
const GPT_IMAGE_2_5_USD = 0.118;

// Child route, MachGen list prices (machgen.ai/pricing.txt, 2026-10-21), not yet measured on a bill.
// Seedream 5.0 Lite: flat per image at every size. FLUX.2 dev: per megapixel of output; inputs are not billed.
// The job reserves on the requested size (about 1.57 MP); MachGen bills the snapped size (FLUX up to 1.85 MP,
// $0.0074), and the step settles with that billed cost.
const SEEDREAM_LITE_USD = 0.038;
const FLUX_DEV_USD_PER_MP = 0.004;

/** Reservation before a paid call. MachGen calls settle with the billed cost after. */
export function estimateUsd(model: ModelId, opts: { quality: Quality; inputCount: number; megapixels: number }): number {
  switch (model) {
    case 'gpt-image-2.5-flare':
    case 'gpt-image-2.5-sunburst':
      return GPT_IMAGE_2_5_USD;
    case 'seedream-5-lite':
      return SEEDREAM_LITE_USD;
    case 'flux-2-dev':
      return FLUX_DEV_USD_PER_MP * opts.megapixels;
  }
}
