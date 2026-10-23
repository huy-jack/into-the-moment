import { describe, expect, it } from 'vitest';
import {
  CHILD_AGE,
  FACE_SMALL_RATIO,
  MAX_FUNCTION_S,
  PAID_CALL_TIMEOUT_MS,
  UPLOAD_CAP_PER_MONTH,
} from '@/src/config';

describe('config', () => {
  it('keeps a paid call inside one function run', () => {
    expect(PAID_CALL_TIMEOUT_MS).toBeLessThan(MAX_FUNCTION_S * 1000);
  });

  it('uses the spec values for small faces and child age', () => {
    expect(FACE_SMALL_RATIO).toBe(0.15);
    expect(CHILD_AGE).toBe(18);
  });

  it('stops uploads before the Blob free limit of 2000', () => {
    expect(UPLOAD_CAP_PER_MONTH).toBeLessThan(2000);
  });
});
