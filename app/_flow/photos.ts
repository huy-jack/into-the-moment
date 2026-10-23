'use client';

import { ApiError, uploadPhoto } from '@/src/ui/api';
import { faceVerdict, type FaceBox } from '@/src/ui/face';
import { checkPhotoFile } from '@/src/ui/flow';
import { findFaces } from './faces';

export type Photo = {
  id: string;
  previewUrl: string;
  status: 'uploading' | 'ready' | 'bad';
  /** Why the photo can't be used, in the user's words. */
  reason?: string;
  pct?: number;
  /** Storage path once uploaded; the job is created from these. */
  path?: string;
  label?: string;
  /** The face the browser found, in the photo's own pixels (for the close-up on the result). */
  face?: { box: FaceBox; width: number; height: number };
  /** A face doubt that does not stop the photo: the server decides. */
  warn?: string;
  /** False when the browser could not run the face check (offline, blocked). */
  faceChecked?: boolean;
};

function dimensions(url: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    // A file the browser can't decode gets 0x0, and the size check names the problem.
    img.onerror = () => resolve({ width: 0, height: 0 });
    img.src = url;
  });
}

/**
 * Checks a file in the browser, then uploads it. `update` receives every change, so the screen
 * shows the preview at once, then the progress, then a tick or the reason. With `face`, the browser
 * also looks for the face while the upload runs: two faces stop the photo, a missing or small face
 * only warns (the server makes the final call).
 */
export async function addPhoto(file: File, update: (p: Photo) => void, opts: { label?: string; face?: boolean } = {}): Promise<void> {
  const previewUrl = URL.createObjectURL(file);
  let photo: Photo = { id: crypto.randomUUID(), previewUrl, status: 'uploading', pct: 0, label: opts.label };
  let stopped = false;
  const set = (p: Partial<Photo>) => {
    if (stopped) return;
    photo = { ...photo, ...p };
    update(photo);
  };
  update(photo);
  const check = checkPhotoFile({ type: file.type, size: file.size, ...(await dimensions(previewUrl)) });
  if (!check.ok) return set({ status: 'bad', reason: check.reason });

  const upload = uploadPhoto(file, (pct) => set({ pct }));
  if (opts.face) {
    const found = await findFaces(previewUrl);
    if (!found) set({ faceChecked: false });
    else {
      const v = faceVerdict(found.faces, found.width, found.height);
      if (v.kind === 'reject') {
        set({ status: 'bad', reason: v.reason });
        stopped = true;
        upload.catch(() => undefined);
        return;
      }
      const box = v.face;
      set({ faceChecked: true, warn: v.kind === 'warn' ? v.reason : undefined, face: box ? { box, width: found.width, height: found.height } : undefined });
    }
  }
  try {
    const path = await upload;
    set({ status: 'ready', path, pct: 100 });
  } catch (err) {
    set({ status: 'bad', reason: err instanceof ApiError ? err.message : 'This photo did not upload. Try again.' });
  }
}
