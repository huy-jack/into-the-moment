import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { driftSparks, extraCount, fileFromUrl, HERO, HERO_LIMITS, HERO_MOTION, heroCopy, sparkCount } from '@/src/ui/hero';

const pub = (src: string) => path.join(process.cwd(), 'public', src);

describe('heroCopy: what the hero may claim', () => {
  it('placeholder: says Example, hides the note and the proof pill', () => {
    expect(heroCopy(false)).toEqual({ tag: 'Example', showNote: false, proof: null });
  });

  it('real: claims a real result and shows the proof pill', () => {
    expect(heroCopy(true)).toEqual({ tag: 'A real result', showNote: true, proof: 'Real output. Only the background is removed.' });
  });
});

describe('extraCount: the badge on the result "You" sticker', () => {
  it.each([
    [0, null],
    [1, null],
    [2, '+1'],
    [4, '+3'],
  ])('%i selfies -> %s', (n, out) => {
    expect(extraCount(n)).toBe(out);
  });
});

describe('fileFromUrl: loads the hero moment as an upload', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('returns a File named as asked, with the response type', async () => {
    vi.stubGlobal('fetch', async () => new Response(new Blob(['x'], { type: 'image/jpeg' }), { status: 200 }));
    const file = await fileFromUrl('/hero/moment.jpg', 'moment.jpg');
    expect(file.name).toBe('moment.jpg');
    expect(file.type).toBe('image/jpeg');
  });

  it('throws the user message on a 404', async () => {
    vi.stubGlobal('fetch', async () => new Response('missing', { status: 404 }));
    await expect(fileFromUrl('/hero/moment.jpg', 'moment.jpg')).rejects.toThrow('This moment did not load. Try again.');
  });

  it('throws the user message when the body breaks off mid-download', async () => {
    vi.stubGlobal('fetch', async () => ({ ok: true, blob: async () => Promise.reject(new TypeError('network error')) }));
    await expect(fileFromUrl('/hero/moment.jpg', 'moment.jpg')).rejects.toThrow('This moment did not load. Try again.');
  });

  it('throws the user message when offline', async () => {
    vi.stubGlobal('fetch', async () => {
      throw new TypeError('Failed to fetch');
    });
    await expect(fileFromUrl('/hero/moment.jpg', 'moment.jpg')).rejects.toThrow('This moment did not load. Try again.');
  });
});

describe('hero files in public/hero', () => {
  it('moment.jpg can be uploaded as a template', async () => {
    const m = await sharp(pub(HERO.moment)).metadata();
    expect(Math.min(m.width!, m.height!)).toBeGreaterThanOrEqual(HERO_LIMITS.photoMinSide);
  });

  it('result.jpg is the uncut result, for step 1', async () => {
    const m = await sharp(pub(HERO.result)).metadata();
    expect(m.hasAlpha).toBe(false);
    expect(Math.min(m.width!, m.height!)).toBeGreaterThanOrEqual(HERO_LIMITS.photoMinSide);
    expect(fs.statSync(pub(HERO.result)).size).toBeLessThanOrEqual(HERO_LIMITS.photoMaxBytes);
  });

  it('person.png has transparency', async () => {
    expect((await sharp(pub(HERO.person)).metadata()).hasAlpha).toBe(true);
  });

  it('files stay within the size limits', () => {
    expect(fs.statSync(pub(HERO.person)).size).toBeLessThanOrEqual(HERO_LIMITS.personMaxBytes);
    expect(fs.statSync(pub(HERO.moment)).size).toBeLessThanOrEqual(HERO_LIMITS.photoMaxBytes);
    expect(fs.statSync(pub(HERO.you)).size).toBeLessThanOrEqual(HERO_LIMITS.photoMaxBytes);
  });

  // The deploy gate: a real hero must be sharp on a 2x screen, so the stock placeholder cannot ship as real.
  it('a real hero meets the image spec', async () => {
    if (!HERO.real) return;
    expect((await sharp(pub(HERO.person)).metadata()).height).toBeGreaterThanOrEqual(HERO_LIMITS.personMinHeight);
    const you = await sharp(pub(HERO.you)).metadata();
    expect(Math.min(you.width!, you.height!)).toBeGreaterThanOrEqual(HERO_LIMITS.photoMinSide);
  });
});

describe('sparkCount: how many sparks drift on the first screen', () => {
  it.each([
    [1440, HERO_MOTION.sparks],
    [821, HERO_MOTION.sparks],
    [820, HERO_MOTION.sparksPhone],
    [390, HERO_MOTION.sparksPhone],
  ])('%i px wide -> %i', (w, n) => {
    expect(sparkCount(w)).toBe(n);
  });
});

describe('driftSparks: where the sparks start and how they move', () => {
  const stage = { width: 1200, height: 820 };
  const panel = { top: 380, bottom: 820 };
  // A fixed sequence, so every run checks the same sparks.
  const seq = (values: number[]) => {
    let i = 0;
    return () => values[i++ % values.length];
  };

  it('makes n sparks, all inside the stage, 8 to 26 px', () => {
    for (const rand of [() => 0, () => 0.999, seq([0.1, 0.5, 0.9, 0.3, 0.7, 0.2, 0.8])]) {
      const sparks = driftSparks(14, stage, panel, rand);
      expect(sparks).toHaveLength(14);
      for (const s of sparks) {
        expect(s.x).toBeGreaterThanOrEqual(0);
        expect(s.x + s.size).toBeLessThanOrEqual(stage.width);
        expect(s.y).toBeGreaterThanOrEqual(0);
        expect(s.y + s.size).toBeLessThanOrEqual(stage.height);
        expect(s.size).toBeGreaterThanOrEqual(8);
        expect(s.size).toBeLessThanOrEqual(26);
      }
    }
  });

  it('a white spark sits only on the violet panel; on the light ground it is violet or lavender', () => {
    const sparks = driftSparks(200, stage, panel, Math.random);
    for (const s of sparks) {
      const onPanel = s.y >= panel.top && s.y <= panel.bottom;
      if (!onPanel) expect(s.tone).not.toBe('white');
    }
    expect(sparks.some((s) => s.tone === 'white')).toBe(true);
  });

  it('starts each loop at a different point: delay between -duration and 0', () => {
    for (const s of driftSparks(50, stage, panel, Math.random)) {
      expect(s.durationMs).toBeGreaterThanOrEqual(7000);
      expect(s.durationMs).toBeLessThanOrEqual(12000);
      expect(s.delayMs).toBeLessThanOrEqual(0);
      expect(s.delayMs).toBeGreaterThan(-s.durationMs);
    }
  });
});
