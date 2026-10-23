import { PHOTO_MIN_SIDE_PX, UPLOAD_CONTENT_TYPES, UPLOAD_MAX_BYTES } from '../config';
import type { ErrorCode } from '../errors';
import { bodyPass, rankCandidates } from '../pipeline/rank';
import type { Candidate, Slot } from '../types';

// Pure rules behind the screens. No React here, so the tests run in node.

export type PhotoCheck = { ok: true } | { ok: false; reason: string };

/** The checks the browser can make before upload. Face checks happen on the server, inside the job. */
export function checkPhotoFile(f: { type: string; size: number; width: number; height: number }): PhotoCheck {
  if (/hei[cf]/i.test(f.type)) {
    return { ok: false, reason: 'This is an iPhone HEIC photo. Choose it again from Photos, or save it as JPEG first.' };
  }
  if (!UPLOAD_CONTENT_TYPES.includes(f.type)) return { ok: false, reason: 'Use a JPEG, PNG or WebP photo.' };
  if (f.size > UPLOAD_MAX_BYTES) return { ok: false, reason: 'This photo is over 15 MB. Use a smaller copy.' };
  if (Math.min(f.width, f.height) < PHOTO_MIN_SIDE_PX) {
    // The limit is PHOTO_MIN_SIDE_PX on the short side; the words say what to do, not the number.
    return {
      ok: false,
      reason: 'This photo is too small to show your face well. Pick the original from your camera roll, not a screenshot or a photo saved from a chat.',
    };
  }
  return { ok: true };
}

const STAGES: Record<string, { label: string; detail: string }> = {
  queued: { label: 'Starting', detail: 'Your photo job is in line.' },
  checking_photos: { label: 'Checking your photos', detail: 'Finding the faces and the person to replace.' },
  reading_scene: { label: 'Studying the moment', detail: 'Reading the pose, light and scene to keep.' },
  making_versions: { label: 'Making 2 versions', detail: 'Two versions, so you can choose. This is the longest step.' },
  checking_likeness: { label: 'Checking it looks like you', detail: 'Comparing each version with your photos.' },
  fixing_face: { label: 'Fixing face details', detail: 'The face is small in this moment, so it gets a closer pass.' },
};

/** The pipeline can visit a stage twice (a retry goes back to making versions), so this names the current stage only. */
export function stageView(stage: string): { label: string; detail: string } {
  return STAGES[stage] ?? { label: 'Working', detail: 'Still working on your photo.' };
}

/** Where the user goes next: the step to fix, the same photos again, or nowhere (closed). */
export type ErrorRoute = 'moment' | 'you' | 'retry' | 'closed' | 'gate';

const ROUTES: Record<ErrorCode, ErrorRoute> = {
  NO_PERSON: 'moment',
  REFUSED_ALL: 'moment',
  NO_FACE: 'you',
  MULTI_FACE: 'you',
  FACE_TOO_SMALL: 'you',
  LOW_RES: 'you',
  BLURRY: 'you',
  BAD_UPLOAD: 'you',
  CHILD_UNSUPPORTED: 'you',
  TIMEOUT: 'retry',
  PROVIDER_ERROR: 'retry',
  STUCK: 'retry',
  JOB_CAP: 'retry',
  SPEND_CAP: 'closed',
  UPLOAD_CAP: 'closed',
  BAD_CODE: 'gate',
};

export function errorRoute(code: ErrorCode): ErrorRoute {
  return ROUTES[code];
}

/** A version as GET /api/jobs/:id sends it. */
export type ApiCandidate = Omit<Candidate, 'path'> & { url: string | null };

export type VersionView = {
  slot: Slot;
  url: string | null;
  best: boolean;
  title: string;
  notes: string[];
  outcome: 'made' | 'refused' | 'failed';
};

/**
 * Every version, best first (same order as the server's ranking). Scores and model names stay out:
 * the user judges by eye, and the notes say in plain words what the check found.
 */
export function versionsForDisplay(cs: ApiCandidate[]): VersionView[] {
  // The API drops storage paths and sends a signed url once the job is finished; rank on that.
  const ranked = rankCandidates(cs.map((c) => ({ ...c, path: c.url }))) as (Candidate & { url: string | null })[];
  // Every version is numbered by its place on the page (A and B mean nothing to a user), so Version 1 always shows.
  return ranked.map((c, i) => {
    const best = i === 0 && !!c.url;
    const kind = c.slot === 'retry' ? ' · second try' : c.slot === 'repair' ? ' · face fixed' : '';
    const title = best ? `Version ${i + 1} · Most like you${kind}` : `Version ${i + 1}${kind}`;
    const outcome = c.refused ? 'refused' : c.url ? 'made' : 'failed';
    return { slot: c.slot, url: c.url, best, title, notes: notesFor(c), outcome };
  });
}

/** The result page's opening line: how many came out. The notes under each plate say what happened to the rest. */
export function resultSummary(vs: VersionView[]): string {
  const made = vs.filter((v) => v.url).length;
  if (made === 0) return 'No version came out. Each try is shown below with what stopped it.';
  const count = made === 1 ? '1 version is' : `${made} versions are`;
  const missed = vs.length - made;
  if (missed === 0) return `${count} ready. The one most like you is first.`;
  return `${count} ready. ${missed} more ${missed === 1 ? 'try' : 'tries'} did not work.`;
}

/** The caption under a filmstrip tile: a version that was not made says so in words, not only with a cross. */
export function thumbLabel(v: VersionView): string {
  const place = v.title.split(' · ')[0];
  return v.url ? place : `${place} · not made`;
}

function notesFor(c: Candidate): string[] {
  if (c.refused) return ['The AI service refused to make this one. It does not say why.'];
  if (c.failed || !c.path) return ['This version could not be made.'];
  const b = c.bodyCheck;
  if (!b || bodyPass(c)) return [];
  return [
    !b.genderMatch && 'Looks like a different gender from you',
    !b.ageBandMatch && 'Looks older or younger than you',
    !b.buildMatch && 'Body build differs from yours',
    !b.faceShapeMatch && 'Face looks slimmer or wider than yours',
    b.stillTemplatePerson && 'Still looks like the person in the moment',
  ].filter((n): n is string => !!n);
}

export type LedgerRow = { label: string; state: 'done' | 'now' | 'next'; at: string | null };

const MAIN = ['checking_photos', 'reading_scene', 'making_versions', 'checking_likeness'];

const clock = (ms: number) => {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

/**
 * The wait screen's stage list. `seen` holds each stage this page saw, in order, with the time it first
 * saw it; a row's time is the job clock when the next stage began. Stages passed before the page opened
 * show as done with no time. A retry and the face repair add rows instead of moving backwards.
 */
export function ledgerRows(seen: { stage: string; at: number }[], createdAt: number): LedgerRow[] {
  const rows: LedgerRow[] = MAIN.map((s) => ({ label: STAGES[s].label, state: 'next', at: null }));
  let cur = -1;
  for (const { stage, at } of seen) {
    let r: number;
    const k = MAIN.indexOf(stage);
    if (stage === 'fixing_face') r = rows.push({ label: STAGES.fixing_face.label, state: 'next', at: null }) - 1;
    else if (k === 2 && cur >= 3) r = rows.push({ label: 'Making one more version', state: 'next', at: null }) - 1;
    else if (k === 3 && cur > 3) r = rows.push({ label: 'Checking the new version', state: 'next', at: null }) - 1;
    else if (k >= 0) r = k;
    else continue;
    if (r === cur) continue;
    if (cur >= 0) rows[cur].at = clock(at - createdAt);
    cur = r;
  }
  return rows.map((row, i) => ({ ...row, state: i < cur ? 'done' : i === cur ? 'now' : 'next' }));
}

/** Blur in px on the moment while the photo is made: 22 before any stage ends, 4 when all have. Never 0: only the real result is sharp. */
export function focusBlur(rows: LedgerRow[]): number {
  const done = rows.filter((r) => r.state === 'done').length;
  return 22 - (18 * done) / Math.max(rows.length, 1);
}

/** The next photo in the full-size viewer: `dir` is 1 or -1, and the ends wrap around. */
export function stepIndex(i: number, n: number, dir: 1 | -1): number {
  return n > 0 ? (i + dir + n) % n : 0;
}
