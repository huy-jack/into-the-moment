import { describe, expect, it } from 'vitest';
import { checkPhotoFile, errorRoute, focusBlur, ledgerRows, resultSummary, stageView, stepIndex, thumbLabel, versionsForDisplay, type ApiCandidate } from '@/src/ui/flow';
import type { BodyCheck } from '@/src/types';

const passCheck: BodyCheck = {
  genderMatch: true,
  ageBandMatch: true,
  buildMatch: true,
  faceShapeMatch: true,
  stillTemplatePerson: false,
  reasons: '',
};

const version = (over: Partial<ApiCandidate>): ApiCandidate => ({
  slot: 'a',
  model: 'gpt-image-2.5-flare',
  attempt: 1,
  url: 'https://blob/a.png',
  refused: false,
  refusalText: null,
  failed: false,
  bodyCheck: passCheck,
  score: 90,
  ...over,
});

describe('checkPhotoFile (before upload, in the browser)', () => {
  it('accepts a JPEG of 1024x768 under 15 MB', () => {
    expect(checkPhotoFile({ type: 'image/jpeg', size: 2_000_000, width: 1024, height: 768 })).toEqual({ ok: true });
  });

  it('names HEIC so iPhone users know what to do', () => {
    const r = checkPhotoFile({ type: 'image/heic', size: 2_000_000, width: 0, height: 0 });
    expect(r.ok).toBe(false);
    expect(!r.ok && r.reason).toMatch(/HEIC/);
  });

  it('refuses other types, files over 15 MB, and a short side under 512 px', () => {
    expect(checkPhotoFile({ type: 'image/gif', size: 1, width: 1000, height: 1000 }).ok).toBe(false);
    expect(checkPhotoFile({ type: 'image/png', size: 15 * 1024 * 1024 + 1, width: 1000, height: 1000 }).ok).toBe(false);
    const small = checkPhotoFile({ type: 'image/webp', size: 1, width: 511, height: 2000 });
    // Plain words, no pixels: say what to do instead.
    expect(!small.ok && small.reason).toBe(
      'This photo is too small to show your face well. Pick the original from your camera roll, not a screenshot or a photo saved from a chat.',
    );
  });
});

describe('stageView', () => {
  it('gives each pipeline stage a plain name', () => {
    expect(stageView('checking_photos').label).toBe('Checking your photos');
    expect(stageView('reading_scene').label).toBe('Studying the moment');
    expect(stageView('making_versions').label).toBe('Making 2 versions');
    expect(stageView('checking_likeness').label).toBe('Checking it looks like you');
    expect(stageView('fixing_face').label).toBe('Fixing face details');
  });

  it('treats queued and unknown stages as starting', () => {
    expect(stageView('queued').label).toBe('Starting');
    expect(stageView('something_new').label).toBe('Working');
  });
});

describe('errorRoute: where a failed job sends the user', () => {
  it('sends photo problems back to the right step', () => {
    expect(errorRoute('NO_PERSON')).toBe('moment');
    for (const c of ['NO_FACE', 'MULTI_FACE', 'FACE_TOO_SMALL', 'LOW_RES', 'BLURRY', 'CHILD_UNSUPPORTED'] as const) {
      expect(errorRoute(c)).toBe('you');
    }
  });

  it('lets service problems retry the same photos, and a refusal pick a new pair', () => {
    for (const c of ['TIMEOUT', 'PROVIDER_ERROR', 'STUCK', 'JOB_CAP'] as const) expect(errorRoute(c)).toBe('retry');
    expect(errorRoute('REFUSED_ALL')).toBe('moment');
  });

  it('closes the app when the budget or upload cap is used up, and asks for the code on BAD_CODE', () => {
    expect(errorRoute('SPEND_CAP')).toBe('closed');
    expect(errorRoute('UPLOAD_CAP')).toBe('closed');
    expect(errorRoute('BAD_CODE')).toBe('gate');
  });
});

describe('versionsForDisplay', () => {
  it('keeps every version, puts the best first and marks only it "most like you"', () => {
    const out = versionsForDisplay([
      version({ slot: 'a', score: 70 }),
      version({ slot: 'b', score: 92 }),
      version({ slot: 'retry', url: null, failed: true, bodyCheck: null, score: null }),
    ]);
    expect(out.map((v) => v.slot)).toEqual(['b', 'a', 'retry']);
    expect(out.map((v) => v.best)).toEqual([true, false, false]);
  });

  it('never shows scores or model names, and says in plain words what failed', () => {
    const [v] = versionsForDisplay([
      version({ bodyCheck: { ...passCheck, ageBandMatch: false, stillTemplatePerson: true, reasons: 'looks 40' } }),
    ]);
    expect(Object.keys(v)).not.toContain('score');
    expect(Object.keys(v)).not.toContain('model');
    expect(v.notes).toEqual(['Looks older or younger than you', 'Still looks like the person in the moment']);
  });

  it('explains refused and failed versions', () => {
    const out = versionsForDisplay([
      version({ slot: 'a', url: null, refused: true, bodyCheck: null, score: null }),
      version({ slot: 'b', url: null, failed: true, bodyCheck: null, score: null }),
    ]);
    expect(out[0].notes).toEqual(['The AI service refused to make this one. It does not say why.']);
    expect(out[1].notes).toEqual(['This version could not be made.']);
    expect(out.some((v) => v.best)).toBe(false);
  });

  it('numbers every version by its place on the page, so Version 1 always shows; the best adds "Most like you"', () => {
    const out = versionsForDisplay([version({ slot: 'a', score: 70 }), version({ slot: 'b', score: 92 })]);
    expect(out.map((v) => v.title)).toEqual(['Version 1 · Most like you', 'Version 2']);
  });

  it('numbers a face repair and a second try in page order, and says what each one is', () => {
    const out = versionsForDisplay([version({ slot: 'repair', score: 95 }), version({ slot: 'retry', score: 50 })]);
    expect(out[0].title).toBe('Version 1 · Most like you · face fixed');
    expect(out[1].title).toBe('Version 2 · second try');
  });

  it('keeps numbering past a version that was not made', () => {
    const out = versionsForDisplay([
      version({ slot: 'a', score: 90 }),
      version({ slot: 'b', score: 60 }),
      version({ slot: 'retry', url: null, refused: true, bodyCheck: null, score: null }),
    ]);
    expect(out.map((v) => v.title)).toEqual(['Version 1 · Most like you', 'Version 2', 'Version 3 · second try']);
  });
});

describe('ledgerRows: the wait screen stage list', () => {
  const t0 = 1_000_000;
  const seen = (...xs: [string, number][]) => xs.map(([stage, s]) => ({ stage, at: t0 + s * 1000 }));

  it('lists the 4 main stages; passed ones are done with the time they finished', () => {
    const rows = ledgerRows(seen(['checking_photos', 1], ['reading_scene', 6], ['making_versions', 14]), t0);
    expect(rows.map((r) => [r.label, r.state, r.at])).toEqual([
      ['Checking your photos', 'done', '0:06'],
      ['Studying the moment', 'done', '0:14'],
      ['Making 2 versions', 'now', null],
      ['Checking it looks like you', 'next', null],
    ]);
  });

  it('marks earlier stages done without a time when the page opened mid-job', () => {
    const rows = ledgerRows(seen(['checking_likeness', 95]), t0);
    expect(rows.map((r) => [r.state, r.at])).toEqual([
      ['done', null],
      ['done', null],
      ['done', null],
      ['now', null],
    ]);
  });

  it('adds a row for the second try when the job goes back to making versions', () => {
    const rows = ledgerRows(seen(['making_versions', 10], ['checking_likeness', 80], ['making_versions', 99]), t0);
    expect(rows.slice(3).map((r) => [r.label, r.state, r.at])).toEqual([
      ['Checking it looks like you', 'done', '1:39'],
      ['Making one more version', 'now', null],
    ]);
  });

  it('adds the face repair row only when the job reaches it', () => {
    const rows = ledgerRows(seen(['checking_likeness', 80], ['fixing_face', 101]), t0);
    expect(rows.at(-1)).toEqual({ label: 'Fixing face details', state: 'now', at: null });
    expect(rows.at(-2)).toEqual({ label: 'Checking it looks like you', state: 'done', at: '1:41' });
  });

  it('shows the queue as a first row before work starts', () => {
    expect(ledgerRows(seen(['queued', 0]), t0)[0]).toEqual({ label: 'Checking your photos', state: 'next', at: null });
  });
});

describe('resultSummary: one short line; the notes under each plate carry the details', () => {
  it('counts the versions that came out', () => {
    expect(resultSummary(versionsForDisplay([version({ slot: 'a' }), version({ slot: 'b' })]))).toBe(
      '2 versions are ready. The one most like you is first.',
    );
    const vs = versionsForDisplay([version({ slot: 'a' }), version({ slot: 'retry', url: null, refused: true, bodyCheck: null, score: null })]);
    expect(resultSummary(vs)).toBe('1 version is ready. 1 more try did not work.');
  });

  it('counts every try that did not work, so a crossed-out tile is never a surprise', () => {
    const vs = versionsForDisplay([
      version({ slot: 'a' }),
      version({ slot: 'b' }),
      version({ slot: 'retry', url: null, refused: true, bodyCheck: null, score: null }),
    ]);
    expect(resultSummary(vs)).toBe('2 versions are ready. 1 more try did not work.');
    const two = versionsForDisplay([version({ slot: 'a' }), version({ slot: 'b', url: null, failed: true, bodyCheck: null, score: null }), version({ slot: 'retry', url: null, refused: true, bodyCheck: null, score: null })]);
    expect(resultSummary(two)).toBe('1 version is ready. 2 more tries did not work.');
  });

  it('says plainly when nothing came out', () => {
    const vs = versionsForDisplay([version({ slot: 'a', url: null, failed: true, bodyCheck: null, score: null })]);
    expect(resultSummary(vs)).toBe('No version came out. Each try is shown below with what stopped it.');
  });
});

describe('thumbLabel: the caption under each filmstrip tile', () => {
  it('names a made version by its place', () => {
    const [v] = versionsForDisplay([version({ slot: 'a' })]);
    expect(thumbLabel(v)).toBe('Version 1');
  });

  it('says a version was not made, in words a sighted user can read', () => {
    const vs = versionsForDisplay([version({ slot: 'a' }), version({ slot: 'retry', url: null, refused: true, bodyCheck: null, score: null })]);
    expect(thumbLabel(vs[1])).toBe('Version 2 · not made');
  });
});

describe('focusBlur: the moment sharpens as stages finish on the wait screen', () => {
  const rows = (done: number, total: number) =>
    Array.from({ length: total }, (_, i) => ({ label: `s${i}`, state: i < done ? 'done' : i === done ? 'now' : 'next', at: null }) as const);

  it('starts at 22px of blur before any stage is done', () => {
    expect(focusBlur(rows(0, 4))).toBe(22);
  });

  it('steps down evenly with each finished stage: 4 stages give 17.5, 13 and 8.5', () => {
    expect([1, 2, 3].map((d) => focusBlur(rows(d, 4)))).toEqual([17.5, 13, 8.5]);
  });

  it('never reaches sharp: 4px when every stage is done, so only the real result is sharp', () => {
    expect(focusBlur(rows(4, 4))).toBe(4);
  });

  it('counts an added retry row, so the photo does not sharpen early', () => {
    expect(focusBlur(rows(4, 6))).toBe(10);
  });
});

describe('stepIndex: arrows in the full-size viewer wrap around', () => {
  it('moves forward and back by one', () => {
    expect(stepIndex(1, 4, 1)).toBe(2);
    expect(stepIndex(1, 4, -1)).toBe(0);
  });

  it('wraps from the last to the first and from the first to the last', () => {
    expect(stepIndex(3, 4, 1)).toBe(0);
    expect(stepIndex(0, 4, -1)).toBe(3);
  });

  it('stays at 0 when there is nothing to show', () => {
    expect(stepIndex(0, 0, 1)).toBe(0);
  });
});
