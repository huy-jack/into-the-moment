import { describe, expect, it } from 'vitest';
import { estimateUsd } from '@/src/providers/prices';

describe('estimateUsd', () => {
  it('reserves the measured MachGen gross price for both GPT Image 2.5 models', () => {
    expect(estimateUsd('gpt-image-2.5-flare', { quality: 'high', inputCount: 3, megapixels: 1.09 })).toBe(0.118);
    expect(estimateUsd('gpt-image-2.5-sunburst', { quality: 'medium', inputCount: 5, megapixels: 1.64 })).toBe(0.118);
  });

  it('seedream 5.0 lite is flat at $0.038 per image, whatever the size or input count', () => {
    expect(estimateUsd('seedream-5-lite', { quality: 'high', inputCount: 1, megapixels: 3.98 })).toBe(0.038);
    expect(estimateUsd('seedream-5-lite', { quality: 'medium', inputCount: 14, megapixels: 4.56 })).toBe(0.038);
  });

  it('flux-2-dev charges $0.004 per output megapixel; inputs are free', () => {
    expect(estimateUsd('flux-2-dev', { quality: 'high', inputCount: 3, megapixels: 1.57 })).toBeCloseTo(0.004 * 1.57, 6);
    expect(estimateUsd('flux-2-dev', { quality: 'high', inputCount: 1, megapixels: 1.57 })).toBeCloseTo(0.004 * 1.57, 6);
  });
});
