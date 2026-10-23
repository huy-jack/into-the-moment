import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { REKOGNITION_MAX_BYTES } from '@/src/config';
import { cropBox, growBox, outputSize, pasteBack, workingCopy } from '@/src/lib/image';

function solid(width: number, height: number) {
  return sharp({ create: { width, height, channels: 3, background: { r: 120, g: 80, b: 40 } } });
}

function noisy(width: number, height: number) {
  const raw = Buffer.alloc(width * height * 3);
  for (let i = 0; i < raw.length; i++) raw[i] = (i * 2654435761) % 256;
  return sharp(raw, { raw: { width, height, channels: 3 } });
}

describe('workingCopy', () => {
  it('rotates EXIF orientation 6', async () => {
    const input = await solid(400, 200).jpeg().withMetadata({ orientation: 6 }).toBuffer();
    const out = await workingCopy(input);
    expect(out.width).toBe(200);
    expect(out.height).toBe(400);
  });

  it('shrinks a 6000x4000 photo under the Rekognition byte limit', async () => {
    const input = await noisy(6000, 4000).jpeg({ quality: 100 }).toBuffer();
    const out = await workingCopy(input);
    expect(Math.max(out.width, out.height)).toBe(2048);
    expect(out.buf.length).toBeLessThan(REKOGNITION_MAX_BYTES);
  });
});

describe('growBox', () => {
  it('clamps to the image edge', () => {
    const b = growBox({ left: 0.9, top: 0.1, width: 0.2, height: 0.2 }, 0.2);
    expect(b.left + b.width).toBeLessThanOrEqual(1);
    expect(b.top).toBeGreaterThanOrEqual(0);
  });
});

describe('outputSize', () => {
  it('keeps a 2:3 ratio with sides divisible by 16', () => {
    const s = outputSize(1000, 1500);
    expect(s.width % 16).toBe(0);
    expect(s.height % 16).toBe(0);
    expect(Math.abs(s.width / s.height - 2 / 3)).toBeLessThan(0.01 * (2 / 3));
  });

  it('clamps a 5:1 ratio to 3:1', () => {
    const s = outputSize(5000, 1000);
    expect(s.width / s.height).toBeLessThanOrEqual(3);
    expect(s.width / s.height).toBeGreaterThan(2.9);
  });
});

describe('cropBox and pasteBack', () => {
  it('keeps the base image size', async () => {
    const base = await solid(300, 400).png().toBuffer();
    const { buf, pixelBox } = await cropBox(base, { left: 0.4, top: 0.2, width: 0.2, height: 0.15 }, 0.3);
    const patch = await sharp(buf).resize(512, 512).png().toBuffer();
    const out = await pasteBack(base, patch, pixelBox);
    const meta = await sharp(out).metadata();
    expect(meta.width).toBe(300);
    expect(meta.height).toBe(400);
  });
});
