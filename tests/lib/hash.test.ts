import { describe, expect, it } from 'vitest';
import { hashRequest } from '@/src/lib/hash';

describe('hashRequest', () => {
  it('ignores key order in the payload', () => {
    const img = Buffer.from('a');
    expect(hashRequest('p', { a: 1, b: { c: 2, d: 3 } }, [img])).toBe(
      hashRequest('p', { b: { d: 3, c: 2 }, a: 1 }, [img]),
    );
  });

  it('changes when an image changes', () => {
    expect(hashRequest('p', { a: 1 }, [Buffer.from('a')])).not.toBe(hashRequest('p', { a: 1 }, [Buffer.from('b')]));
  });
});
