import sharp from 'sharp';
import {
  OUTPUT_MAX_PX,
  OUTPUT_MAX_RATIO,
  OUTPUT_MIN_PX,
  OUTPUT_TARGET_PX,
  REKOGNITION_MAX_BYTES,
  WORKING_COPY_MAX_PX,
} from '../config';
import type { Box } from '../types';

export type PixelBox = { x: number; y: number; w: number; h: number };

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Upright JPEG copy, longest edge at most WORKING_COPY_MAX_PX, under the Rekognition byte limit. */
export async function workingCopy(input: Buffer): Promise<{ buf: Buffer; width: number; height: number }> {
  const upright = sharp(input).rotate().resize({
    width: WORKING_COPY_MAX_PX,
    height: WORKING_COPY_MAX_PX,
    fit: 'inside',
    withoutEnlargement: true,
  });
  for (const quality of [90, 80, 70, 60]) {
    const { data, info } = await upright.clone().jpeg({ quality }).toBuffer({ resolveWithObject: true });
    if (data.length < REKOGNITION_MAX_BYTES) return { buf: data, width: info.width, height: info.height };
  }
  throw new Error('working copy stays over the Rekognition byte limit');
}

/** Grow each side by `by × size / 2`, clamped to the image. */
export function growBox(box: Box, by: number): Box {
  const left = clamp(box.left - (box.width * by) / 2, 0, 1);
  const top = clamp(box.top - (box.height * by) / 2, 0, 1);
  const right = clamp(box.left + box.width + (box.width * by) / 2, 0, 1);
  const bottom = clamp(box.top + box.height + (box.height * by) / 2, 0, 1);
  return { left, top, width: right - left, height: bottom - top };
}

export function toPixels(box: Box, width: number, height: number): PixelBox {
  const x = Math.round(box.left * width);
  const y = Math.round(box.top * height);
  const w = Math.max(1, Math.min(width - x, Math.round(box.width * width)));
  const h = Math.max(1, Math.min(height - y, Math.round(box.height * height)));
  return { x, y, w, h };
}

export async function cropBox(img: Buffer, box: Box, pad: number): Promise<{ buf: Buffer; pixelBox: PixelBox }> {
  const meta = await sharp(img).metadata();
  const pixelBox = toPixels(growBox(box, pad), meta.width!, meta.height!);
  const buf = await sharp(img)
    .extract({ left: pixelBox.x, top: pixelBox.y, width: pixelBox.w, height: pixelBox.h })
    .png()
    .toBuffer();
  return { buf, pixelBox };
}

const FEATHER_PX = 8;

/** Resize the patch to the pixel box and paste it back with a feathered edge. */
export async function pasteBack(base: Buffer, patch: Buffer, pb: PixelBox): Promise<Buffer> {
  const inset = Math.min(FEATHER_PX, Math.floor(Math.min(pb.w, pb.h) / 4));
  const core = await sharp({
    create: { width: pb.w - 2 * inset, height: pb.h - 2 * inset, channels: 3, background: { r: 255, g: 255, b: 255 } },
  })
    .png()
    .toBuffer();
  // sharp applies composite last in a pipeline, so composite first and blur in a second pass.
  const hard = await sharp({ create: { width: pb.w, height: pb.h, channels: 3, background: { r: 0, g: 0, b: 0 } } })
    .composite([{ input: core, left: inset, top: inset }])
    .png()
    .toBuffer();
  const alpha = await sharp(hard)
    .blur(Math.max(0.3, inset / 2))
    .extractChannel(0)
    .raw()
    .toBuffer();
  const feathered = await sharp(patch)
    .resize(pb.w, pb.h, { fit: 'fill' })
    .removeAlpha()
    .joinChannel(alpha, { raw: { width: pb.w, height: pb.h, channels: 1 } })
    .png()
    .toBuffer();
  return sharp(base).composite([{ input: feathered, left: pb.x, top: pb.y }]).png().toBuffer();
}

const round16 = (v: number) => Math.max(16, Math.round(v / 16) * 16);

/** Output size near 1.5 MP that keeps the template ratio (clamped to 3:1). */
export function outputSize(width: number, height: number): { width: number; height: number } {
  const ratio = clamp(width / height, 1 / OUTPUT_MAX_RATIO, OUTPUT_MAX_RATIO);
  let h = Math.sqrt(OUTPUT_TARGET_PX / ratio);
  let w = h * ratio;
  let out = { width: round16(w), height: round16(h) };
  // Rounding to 16 can push the ratio past 3:1 or the pixel count out of range; nudge back.
  while (out.width / out.height > OUTPUT_MAX_RATIO) out = { ...out, width: out.width - 16 };
  while (out.height / out.width > OUTPUT_MAX_RATIO) out = { ...out, height: out.height - 16 };
  const px = out.width * out.height;
  if (px < OUTPUT_MIN_PX || px > OUTPUT_MAX_PX) {
    const k = Math.sqrt((px < OUTPUT_MIN_PX ? OUTPUT_MIN_PX : OUTPUT_MAX_PX) / px);
    w = out.width * k;
    h = out.height * k;
    out = { width: round16(w), height: round16(h) };
  }
  return out;
}
