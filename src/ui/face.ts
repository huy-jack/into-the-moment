import { FACE_MIN_HEIGHT_PX, WORKING_COPY_MAX_PX } from '../config';

// Rules on face boxes found in the browser. No browser APIs here, so the tests run in node.

/** A face in image pixels. `eyes` are the two eye points when the finder gives them. */
export type FaceBox = { x: number; y: number; w: number; h: number; score: number; eyes?: [number, number][] };

export type FaceVerdict =
  | { kind: 'ok'; face: FaceBox }
  | { kind: 'warn'; reason: string; face?: FaceBox }
  | { kind: 'reject'; reason: string };

/** A second face counts only when the finder is this sure of it. */
const SECOND_FACE_MIN_SCORE = 0.7;

/**
 * The upload check. It is never stricter than the server: the browser finder misses far or turned
 * faces, so "no face" and "small face" only warn and the photo still uploads. Two sure faces are
 * refused, as the server refuses them.
 */
export function faceVerdict(faces: FaceBox[], width: number, height: number): FaceVerdict {
  if (faces.filter((f) => f.score >= SECOND_FACE_MIN_SCORE).length >= 2) {
    return { kind: 'reject', reason: 'Two or more faces in this photo. Use one with only you.' };
  }
  if (faces.length === 0) {
    return { kind: 'warn', reason: 'We could not find your face here. If it is small or turned away, this photo may be left out.' };
  }
  const face = faces.reduce((a, b) => (b.score > a.score ? b : a));
  // The server checks a copy no larger than 2048 px, so measure the face at that scale.
  const scale = Math.min(1, WORKING_COPY_MAX_PX / Math.max(width, height));
  if (face.h * scale < FACE_MIN_HEIGHT_PX) {
    return { kind: 'warn', reason: 'Your face is small in this photo. Use a closer one, or it may be left out.', face };
  }
  return { kind: 'ok', face };
}

/**
 * The face box on a square tile that shows the photo centre-cropped (object-fit: cover), as CSS
 * percentages of the tile. The part of the box outside the crop is cut off.
 */
export function faceInSquare(face: FaceBox, width: number, height: number) {
  const side = Math.min(width, height);
  const offX = (width - side) / 2;
  const offY = (height - side) / 2;
  const pct = (v: number) => Math.min(Math.max(v / side, 0), 1) * 100;
  const left = pct(face.x - offX);
  const top = pct(face.y - offY);
  return { left, top, width: pct(face.x + face.w - offX) - left, height: pct(face.y + face.h - offY) - top };
}

/** Where the eyes sit in every crop, from the top, so two crops line up. */
const EYE_LINE = 0.42;

/**
 * A square crop around a face for the side-by-side detail: `scale` times the face height (2 on
 * desktop, tighter on a phone), eyes at 42% from the top, kept inside the image. `size`, `posX` and `posY` are CSS background percentages.
 */
export function faceCrop(face: FaceBox, width: number, height: number, scale = 2) {
  const side = Math.round(Math.min(face.h * scale, width, height));
  const [cx, eyeY] = face.eyes?.length === 2
    ? [(face.eyes[0][0] + face.eyes[1][0]) / 2, (face.eyes[0][1] + face.eyes[1][1]) / 2]
    : [face.x + face.w / 2, face.y + face.h * 0.4];
  const clamp = (v: number, max: number) => Math.round(Math.min(Math.max(v, 0), max));
  const left = clamp(cx - side / 2, width - side);
  const top = clamp(eyeY - EYE_LINE * side, height - side);
  const pct = (v: number, room: number) => (room > 0 ? (v / room) * 100 : 50);
  return { side, left, top, size: (width / side) * 100, posX: pct(left, width - side), posY: pct(top, height - side) };
}
