/**
 * Threshold from CompareFaces scores of same-person pairs and different-person pairs.
 * No overlap: the midpoint. Overlap: the highest different-person score, so a stranger never passes.
 */
export function suggestThreshold(same: number[], diff: number[]): { t: number; minSame: number; maxDiff: number; overlap: boolean } {
  const minSame = Math.min(...same);
  const maxDiff = Math.max(...diff);
  const overlap = maxDiff >= minSame;
  return { t: overlap ? maxDiff : (minSame + maxDiff) / 2, minSame, maxDiff, overlap };
}
