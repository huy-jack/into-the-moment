import { PHOTO_MIN_SIDE_PX } from '../config';

// Pure rules behind the hero: one result shown on the first screens. No React here, so the tests run in node.

/**
 * The hero set in public/hero. Swap the three files for a real result and set `real`, and the
 * screens start claiming "A real result" (spec 5.3). The tests refuse a real hero that is too small.
 */
export const HERO = {
  real: true,
  momentLabel: 'Drawing a bow',
  person: '/hero/person.png',
  /** The same result with its own background, for step 1. */
  result: '/hero/result.jpg',
  moment: '/hero/moment.jpg',
  you: '/hero/you.jpg',
};

export const HERO_LIMITS = {
  personMinHeight: 1100,
  photoMinSide: PHOTO_MIN_SIDE_PX,
  personMaxBytes: 400_000,
  photoMaxBytes: 120_000,
};

/** A placeholder must not claim it was made from the two stickers, so the note and the proof pill wait for a real set. */
export function heroCopy(real: boolean): { tag: string; showNote: boolean; proof: string | null } {
  return real
    ? { tag: 'A real result', showNote: true, proof: 'Real output. Only the background is removed.' }
    : { tag: 'Example', showNote: false, proof: null };
}

/** The "You" sticker shows the first selfie; the rest are counted on its corner. */
export function extraCount(selfies: number): string | null {
  return selfies > 1 ? `+${selfies - 1}` : null;
}

/** The first screen's motion. Phones get fewer sparks; the build-in runs once, then the idle loops start. */
export const HERO_MOTION = {
  sparks: 14,
  sparksPhone: 6,
  phoneMaxWidth: 820,
  introMs: 2600,
  nearEveryMs: 6500,
};

export function sparkCount(viewportWidth: number): number {
  return viewportWidth <= HERO_MOTION.phoneMaxWidth ? HERO_MOTION.sparksPhone : HERO_MOTION.sparks;
}

export type SparkTone = 'violet' | 'light' | 'white';

export type DriftSpark = {
  x: number;
  y: number;
  size: number;
  tone: SparkTone;
  /** Where the loop ends, from the start point. Sparks rise as they drift. */
  dx: number;
  dy: number;
  durationMs: number;
  /** Negative, so the sparks are spread along their loops from the first frame. */
  delayMs: number;
};

type Box = { width: number; height: number };

/** Places the drifting sparks. A white spark sits only on the violet panel band, where it shows. */
export function driftSparks(n: number, stage: Box, panel: { top: number; bottom: number }, rand: () => number = Math.random): DriftSpark[] {
  const between = (a: number, b: number) => a + rand() * (b - a);
  return Array.from({ length: n }, () => {
    const size = Math.round(between(8, 26));
    const x = Math.min(between(0.02, 0.92) * stage.width, stage.width - size);
    const y = Math.min(between(0.04, 0.95) * stage.height, stage.height - size);
    const onPanel = y >= panel.top && y <= panel.bottom;
    const tone: SparkTone = onPanel ? (rand() < 0.6 ? 'white' : 'light') : rand() < 0.5 ? 'violet' : 'light';
    const dx = between(80, 220) * (rand() < 0.5 ? -1 : 1);
    const dy = between(-90, -30);
    const durationMs = Math.round(between(7000, 12000));
    const delayMs = -Math.floor(rand() * (durationMs - 1));
    return { x, y, size, tone, dx, dy, durationMs, delayMs };
  });
}

const MOMENT_FAILED = 'This moment did not load. Try again.';

/** Fetches a shipped photo as a File, so it goes through the same checks and upload as the user's own. */
export async function fileFromUrl(src: string, name: string): Promise<File> {
  const res = await fetch(src).catch(() => null);
  const blob = res?.ok ? await res.blob().catch(() => null) : null;
  if (!blob) throw new Error(MOMENT_FAILED);
  return new File([blob], name, { type: blob.type });
}
