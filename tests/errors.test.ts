import { describe, expect, it } from 'vitest';
import { ERROR_CODES, userMessage } from '@/src/errors';

describe('userMessage', () => {
  it('uses the exact copy from the spec', () => {
    expect(userMessage('FACE_TOO_SMALL')).toBe('Face too small: use a closer photo.');
    expect(userMessage('MULTI_FACE')).toBe('Two faces found: use a photo with only you.');
    expect(userMessage('BAD_CODE')).toBe('That code is not right. Check the email you got.');
  });

  it('has a message for every error code', () => {
    for (const code of ERROR_CODES) {
      expect(userMessage(code).length).toBeGreaterThan(10);
    }
  });
});
