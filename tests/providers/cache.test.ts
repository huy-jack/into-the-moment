import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RefusalError } from '@/src/errors';
import { cached } from '@/src/providers/cache';

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), 'cache-'));
});

const opts = (mode: 'live' | 'record' | 'replay') => ({
  mode,
  dir,
  provider: 'fake',
  payload: { prompt: 'x' },
  images: [Buffer.from('img')],
});

describe('cached', () => {
  it('record writes then replay reads without calling', async () => {
    const call = vi.fn(async () => ({ score: 91 }));
    await cached(opts('record'), call);
    const replayed = await cached(opts('replay'), call);
    expect(replayed).toEqual({ score: 91 });
    expect(call).toHaveBeenCalledTimes(1);
  });

  it('replay miss throws and does not call', async () => {
    const call = vi.fn(async () => ({ score: 1 }));
    await expect(cached(opts('replay'), call)).rejects.toThrow(/replay miss: fake/);
    expect(call).not.toHaveBeenCalled();
  });

  it('buffers survive the round trip', async () => {
    const image = Buffer.from([1, 2, 3, 250]);
    await cached(opts('record'), async () => ({ image, usd: 0.1 }));
    const out = await cached(opts('replay'), async () => ({ image: Buffer.alloc(0), usd: 0 }));
    expect(Buffer.compare(out.image, image)).toBe(0);
    expect(out.usd).toBe(0.1);
  });

  it('refusal is recorded and replayed as RefusalError with the same text', async () => {
    await expect(
      cached(opts('record'), async () => {
        throw new RefusalError('blocked by safety system');
      }),
    ).rejects.toBeInstanceOf(RefusalError);
    const err = await cached(opts('replay'), async () => ({})).catch((e) => e);
    expect(err).toBeInstanceOf(RefusalError);
    expect(err.text).toBe('blocked by safety system');
  });
});
