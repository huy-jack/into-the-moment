'use client';

import type { FaceDetector } from '@mediapipe/tasks-vision';
import type { FaceBox } from '@/src/ui/face';

// The face finder runs in the browser: photos never leave the device for this check.
// First use downloads about 4.7 MB (3.6 MB engine from jsdelivr, 1.1 MB model from Google's model
// storage), then the browser caches it. Both paths are pinned. The full-range model finds the small
// faces of full-body results that the short-range one misses (measured on the fixture photos).
const VERSION = '1.1.1';
const WASM = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VERSION}/wasm`;
const MODEL = 'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_full_range/float16/1/blaze_face_full_range.tflite';

let detector: Promise<FaceDetector | null> | null = null;

/** Starts loading once; later calls share it. Resolves null when the finder cannot load (offline, blocked). */
export function warmFaces(): Promise<FaceDetector | null> {
  detector ??= (async () => {
    try {
      const { FaceDetector, FilesetResolver } = await import('@mediapipe/tasks-vision');
      const files = await FilesetResolver.forVisionTasks(WASM);
      return await FaceDetector.createFromOptions(files, {
        baseOptions: { modelAssetPath: MODEL },
        runningMode: 'IMAGE',
        minDetectionConfidence: 0.5,
      });
    } catch {
      return null;
    }
  })();
  return detector;
}

export type Found = { faces: FaceBox[]; width: number; height: number };

/**
 * Faces in an image, in its own pixels. Null when the finder is unavailable or the browser will not
 * let it read the pixels (a cross-site image without CORS): callers then skip the face features.
 */
export async function findFaces(src: string): Promise<Found | null> {
  const det = await warmFaces();
  if (!det) return null;
  try {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = src;
    await img.decode();
    const { detections } = det.detect(img);
    const width = img.naturalWidth;
    const height = img.naturalHeight;
    return {
      width,
      height,
      faces: detections.flatMap((d) => {
        const b = d.boundingBox;
        if (!b) return [];
        // Keypoints come as 0..1 of the image; the first two are the eyes.
        const eyes = d.keypoints?.slice(0, 2).map((k) => [k.x * width, k.y * height] as [number, number]);
        return [{ x: b.originX, y: b.originY, w: b.width, h: b.height, score: d.categories[0]?.score ?? 0, eyes: eyes?.length === 2 ? eyes : undefined }];
      }),
    };
  } catch {
    return null;
  }
}
