import { describe, expect, it } from 'vitest';
import { faceCrop, faceInSquare, faceVerdict, type FaceBox } from '@/src/ui/face';

// Boxes measured by the browser face finder on the fixture photos (1600x1067).
const a1: FaceBox = { x: 643, y: 236, w: 446, h: 446, score: 0.97, eyes: [[787, 370], [965, 346]] };
const small: FaceBox = { x: 100, y: 100, w: 90, h: 90, score: 0.9 };

describe('faceVerdict: the upload check in the browser', () => {
  it('passes one clear face', () => {
    expect(faceVerdict([a1], 1600, 1067)).toEqual({ kind: 'ok', face: a1 });
  });

  it('rejects two confident faces, like the server does', () => {
    const v = faceVerdict([a1, { ...a1, x: 100, score: 0.8 }], 1600, 1067);
    expect(v.kind).toBe('reject');
    expect(v.kind === 'reject' && v.reason).toMatch(/only you/);
  });

  it('ignores a second face the finder is unsure about', () => {
    expect(faceVerdict([a1, { ...a1, x: 100, score: 0.5 }], 1600, 1067).kind).toBe('ok');
  });

  it('only warns when no face is found: the server decides (far faces are often missed here)', () => {
    const v = faceVerdict([], 1600, 1067);
    expect(v.kind).toBe('warn');
    expect(v.kind === 'warn' && v.reason).toMatch(/may be left out/);
  });

  it('warns on a small face, measured on the 2048 px copy the server checks (128 px floor)', () => {
    expect(faceVerdict([small], 1600, 1067).kind).toBe('warn');
    // 120 px tall in a 4000 px wide photo is 61 px on the server copy: too small.
    expect(faceVerdict([{ ...small, h: 200, w: 200 }], 4000, 3000).kind).toBe('warn');
    // 140 px in a 1600 px photo stays 140 px: fine.
    expect(faceVerdict([{ ...small, h: 140, w: 140 }], 1600, 1067).kind).toBe('ok');
  });
});

describe('faceCrop: a square around the face, eyes at the same height in every crop', () => {
  it('centres on the eyes with room for the whole head, as background size and position', () => {
    const c = faceCrop(a1, 1600, 1067);
    // side = 2 x face height = 892 px; eyes midpoint (876, 358) at 42% from the top.
    expect(c.side).toBe(892);
    expect(c.left).toBe(430);
    expect(c.top).toBe(0); // 358 - 0.42 * 892 = -17, clamped to the image
    expect(c.size).toBeCloseTo((1600 / 892) * 100, 3);
  });

  it('crops tighter on a phone (1.3 times the face height), so the face fills more of a small plate', () => {
    expect(faceCrop(a1, 1600, 1067, 1.3).side).toBe(580);
  });

  it('falls back to the box centre without eye points, and keeps the square inside the image', () => {
    const c = faceCrop({ x: 1500, y: 900, w: 80, h: 80, score: 0.9 }, 1600, 1067);
    expect(c.left + c.side).toBeLessThanOrEqual(1600);
    expect(c.top + c.side).toBeLessThanOrEqual(1067);
  });
});

describe('faceInSquare: where the face box sits on a square, centre-cropped photo tile', () => {
  it('cuts the sides of a wide photo: 1600x1067 shows x 266.5 to 1333.5', () => {
    const b = faceInSquare(a1, 1600, 1067);
    expect(b.left).toBeCloseTo(((643 - 266.5) / 1067) * 100, 3);
    expect(b.top).toBeCloseTo((236 / 1067) * 100, 3);
    expect(b.width).toBeCloseTo((446 / 1067) * 100, 3);
    expect(b.height).toBeCloseTo((446 / 1067) * 100, 3);
  });

  it('cuts the top and bottom of a tall photo: 800x1200 shows y 200 to 1000', () => {
    const b = faceInSquare({ x: 300, y: 260, w: 200, h: 240, score: 0.9 }, 800, 1200);
    expect(b).toEqual({ left: 37.5, top: 7.5, width: 25, height: 30 });
  });

  it('keeps a face that runs past the crop inside the tile', () => {
    const b = faceInSquare({ x: 0, y: 100, w: 300, h: 300, score: 0.9 }, 1200, 800);
    expect(b.left).toBe(0);
    expect(b.width).toBeCloseTo(12.5, 3);
    expect(b.top).toBeCloseTo(12.5, 3);
  });
});
