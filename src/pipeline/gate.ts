import { FACE_MIN_HEIGHT_PX, PHOTO_MIN_SIDE_PX, SHARPNESS_MIN } from '../config';
import type { FaceInfo, GateResult } from '../types';

/** Photo gate for a user photo. Checks run in this order; the first failure wins. */
export function gateUserPhoto(faces: FaceInfo[], width: number, height: number): GateResult {
  if (faces.length === 0) return { ok: false, code: 'NO_FACE' };
  if (faces.length > 1) return { ok: false, code: 'MULTI_FACE' };
  if (Math.min(width, height) < PHOTO_MIN_SIDE_PX) return { ok: false, code: 'LOW_RES' };
  const [face] = faces;
  if (face.box.height * height < FACE_MIN_HEIGHT_PX) return { ok: false, code: 'FACE_TOO_SMALL' };
  if (face.sharpness < SHARPNESS_MIN) return { ok: false, code: 'BLURRY' };
  return { ok: true };
}
