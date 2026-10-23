import { describe, expect, it } from 'vitest';
import { FatalError, SpendCapError } from '@/src/errors';
import { runSwap } from '@/src/pipeline/runSwap';
import { analyze, generateVersion, prepareInputs } from '@/src/pipeline/steps';
import type { Deps, Reservation } from '@/src/pipeline/deps';
import { makeFakes } from '../helpers/fakes';

/** Every reservation made before a paid call, with its estimate. */
function spyReservations(deps: Deps): Reservation[] {
  const seen: Reservation[] = [];
  const reserve = deps.ledger.reserve.bind(deps.ledger);
  deps.ledger.reserve = async (r, cap) => {
    seen.push(r);
    return reserve(r, cap);
  };
  return seen;
}

describe('runSwap', () => {
  it('adult job makes two versions and ranks them', async () => {
    const f = await makeFakes();
    const out = await runSwap(f.deps, f.input());
    expect(out.analysis.route).toBe('adult');
    expect(out.result.status).toBe('done');
    if (out.result.status !== 'done') return;
    expect(out.result.ranked.map((c) => c.model).sort()).toEqual(['gpt-image-2.5-flare', 'gpt-image-2.5-sunburst']);
    for (const c of out.result.ranked) expect(await f.store.exists(c.path!)).toBe(true);
    expect(out.costs.length).toBeGreaterThan(0);
  });

  it('child job never calls an OpenAI model', async () => {
    const f = await makeFakes({ templateAge: 9 });
    const out = await runSwap(f.deps, f.input());
    expect(out.analysis.route).toBe('child');
    expect(f.calls.map((c) => c.model)).not.toContain('gpt-image-2.5-flare');
    expect(f.calls.map((c) => c.model)).not.toContain('gpt-image-2.5-sunburst');
  });

  it('a child job runs Seedream 5.0 Lite and FLUX.2 dev and reserves a real price for each, repair included', async () => {
    // A small template face, so the best version also gets a face repair.
    const f = await makeFakes({ templateAge: 9, templateFaceBox: { left: 0.45, top: 0.1, width: 0.05, height: 0.05 } });
    const reserved = spyReservations(f.deps);
    const out = await runSwap(f.deps, f.input());
    expect(out.result.status).toBe('done');
    expect(f.calls.slice(0, 2).map((c) => c.model).sort()).toEqual(['flux-2-dev', 'seedream-5-lite']);
    // FLUX.2 dev takes 3 images: the template and 2 refs.
    expect(f.calls.find((c) => c.model === 'flux-2-dev')!.images).toHaveLength(3);
    const paidImages = reserved.filter((r) => r.step.startsWith('generate') || r.step === 'repair');
    expect(paidImages.map((r) => r.step).sort()).toEqual(['generate-a', 'generate-b', 'repair']);
    for (const r of paidImages) {
      expect(['seedream-5-lite', 'flux-2-dev']).toContain(r.provider);
      expect(r.estimateUsd).toBeGreaterThan(0);
    }
  });

  it('a child job with any child model unsupported fails CHILD_UNSUPPORTED before any image call', async () => {
    for (const unsupported of [['seedream-5-lite', 'flux-2-dev'], ['flux-2-dev']] as const) {
      const f = await makeFakes({ templateAge: 9, unsupported: [...unsupported] });
      const err = await runSwap(f.deps, f.input()).catch((e) => e);
      expect(err).toBeInstanceOf(FatalError);
      expect(err.code).toBe('CHILD_UNSUPPORTED');
      expect(f.calls).toHaveLength(0);
      expect((await f.ledger.all()).filter((r) => r.step.startsWith('generate'))).toHaveLength(0);
    }
  });

  it('a refused child version has no fallback: the job finishes with the other version', async () => {
    const f = await makeFakes({ templateAge: 9, behavior: { 'seedream-5-lite': 'refuse' } });
    const out = await runSwap(f.deps, f.input());
    expect(f.calls.map((c) => c.model).sort()).toEqual(['flux-2-dev', 'seedream-5-lite']);
    expect(out.result.status).toBe('done');
  });

  it('all refused gives REFUSED_ALL', async () => {
    const f = await makeFakes({ templateAge: 9, behavior: { 'seedream-5-lite': 'refuse', 'flux-2-dev': 'refuse' } });
    const out = await runSwap(f.deps, f.input());
    expect(out.result).toMatchObject({ status: 'failed', code: 'REFUSED_ALL' });
    // The refusal text must survive for the README.
    expect(out.result.ranked.filter((c) => c.refused).map((c) => c.model).sort()).toEqual(['flux-2-dev', 'seedream-5-lite']);
  });

  it('a timeout on B still finishes with A', async () => {
    const f = await makeFakes({ behavior: { 'gpt-image-2.5-sunburst': 'timeout' } });
    const out = await runSwap(f.deps, f.input());
    expect(out.result.status).toBe('done');
    if (out.result.status !== 'done') return;
    expect(out.result.ranked[0].model).toBe('gpt-image-2.5-flare');
    expect(out.result.ranked.find((c) => c.model === 'gpt-image-2.5-sunburst')?.failed).toBe(true);
  });

  it('no image on A still finishes with B', async () => {
    const f = await makeFakes({ behavior: { 'gpt-image-2.5-flare': 'fatal' } });
    const out = await runSwap(f.deps, f.input());
    expect(out.result.status).toBe('done');
    if (out.result.status !== 'done') return;
    expect(out.result.ranked[0].path).not.toBeNull();
  });

  it('a template with no person throws NO_PERSON before any image call', async () => {
    const f = await makeFakes({ persons: [] });
    const err = await runSwap(f.deps, f.input()).catch((e) => e);
    expect(err).toBeInstanceOf(FatalError);
    expect(err.code).toBe('NO_PERSON');
    expect(f.calls).toHaveLength(0);
  });

  it('a rerun of a finished generation makes no paid call and adds no cost row', async () => {
    const f = await makeFakes();
    const input = f.input();
    const prep = await prepareInputs(f.deps, input);
    const an = await analyze(f.deps, input, prep);
    await generateVersion(f.deps, input, prep, an, 'a', 'gpt-image-2.5-flare', 1);
    const rows = (await f.ledger.all()).length;
    const again = await generateVersion(f.deps, input, prep, an, 'a', 'gpt-image-2.5-flare', 1);
    expect(f.calls).toHaveLength(1);
    expect((await f.ledger.all()).length).toBe(rows);
    expect(again.path).toBe('jobs/job1/a-1.png');
  });

  it('the spend cap stops the next paid call but keeps the version already made', async () => {
    // Prepare+analyze 0.006 plus one $0.118 version fits 0.13; the second version does not.
    const f = await makeFakes({ spendCapUsd: 0.13 });
    const out = await runSwap(f.deps, f.input());
    expect(f.calls).toHaveLength(1);
    expect(out.result.status).toBe('done');
    expect(out.result.ranked.filter((c) => c.error === 'SPEND_CAP')).toHaveLength(1);
    expect(out.result.ranked[0].path).not.toBeNull();
  });

  it('a spend cap hit during evaluation keeps both paid versions, unscored', async () => {
    // Prepare+analyze 0.006; both image estimates (0.118 each) fit the cap; actual 0.17 each
    // leaves 0.0006, so every $0.001 check is over the cap.
    const f = await makeFakes({ spendCapUsd: 0.3466, imageUsd: 0.17 });
    const out = await runSwap(f.deps, f.input());
    expect(out.result.status).toBe('done');
    expect(out.result.ranked.filter((c) => c.path)).toHaveLength(2);
    expect(out.result.ranked.some((c) => c.score === null)).toBe(true);
  });

  it('an evaluation error keeps the version with no score or body check', async () => {
    const f = await makeFakes({ compareThrows: true, bodyCheckThrows: true });
    const out = await runSwap(f.deps, f.input());
    expect(out.result.status).toBe('done');
    for (const c of out.result.ranked.filter((v) => v.path)) {
      expect(c.score).toBeNull();
      expect(c.bodyCheck).toBeNull();
    }
  });

  it('scores a JPEG working copy of the result, under the Rekognition byte limit', async () => {
    const f = await makeFakes();
    await runSwap(f.deps, f.input());
    expect(f.compareInputs.length).toBeGreaterThan(0);
    for (const b of f.compareInputs) expect([b[0], b[1]]).toEqual([0xff, 0xd8]);
  });

  it('a child anywhere in the template sends the job to the child route', async () => {
    const f = await makeFakes({
      templateAge: 35,
      extraTemplateFaces: [{ box: { left: 0.85, top: 0.6, width: 0.08, height: 0.1 }, ageLow: 6, ageHigh: 10, sharpness: 80 }],
    });
    const out = await runSwap(f.deps, f.input());
    expect(out.analysis.route).toBe('child');
    expect(f.calls.map((c) => c.model)).not.toContain('gpt-image-2.5-flare');
    // The face to repair is the main person's face, never the bystander's.
    expect(out.prep.template.faceBox).toEqual({ left: 0.4, top: 0.1, width: 0.2, height: 0.3 });
  });

  it('a face outside the main person is never used as the template face', async () => {
    const f = await makeFakes({
      templateFaceBox: null,
      extraTemplateFaces: [{ box: { left: 0.85, top: 0.6, width: 0.08, height: 0.1 }, ageLow: 30, ageHigh: 38, sharpness: 80 }],
    });
    const prep = await prepareInputs(f.deps, f.input());
    expect(prep.template.faceBox).toBeNull();
  });

  it('a timeout leaves the estimated cost on the ledger, so the cap still sees the charge', async () => {
    const f = await makeFakes({ behavior: { 'gpt-image-2.5-sunburst': 'timeout' } });
    await runSwap(f.deps, f.input());
    const row = (await f.ledger.all()).find((r) => r.provider === 'gpt-image-2.5-sunburst');
    expect(row?.usd).toBeGreaterThan(0.06);
  });

  it('a crash after the provider accepted the job resumes that request instead of paying again', async () => {
    const f = await makeFakes({ behavior: { 'gpt-image-2.5-flare': 'crash-after-submit-once' } });
    const input = f.input();
    const prep = await prepareInputs(f.deps, input);
    const an = await analyze(f.deps, input, prep);
    await expect(generateVersion(f.deps, input, prep, an, 'a', 'gpt-image-2.5-flare', 1)).rejects.toThrow(/crashed/);
    const again = await generateVersion(f.deps, input, prep, an, 'a', 'gpt-image-2.5-flare', 1);
    expect(again.path).toBe('jobs/job1/a-1.png');
    expect(f.calls.filter((c) => c.model === 'gpt-image-2.5-flare')).toHaveLength(1);
    expect(f.resumed).toEqual(['r1']);
    expect((await f.ledger.all()).filter((r) => r.step === 'generate-a')).toHaveLength(1);
  });

  it('a low score on the adult route triggers exactly one retry of A', async () => {
    const f = await makeFakes({ score: 70, faceT: 80 });
    await runSwap(f.deps, f.input());
    expect(f.calls.filter((c) => c.model === 'gpt-image-2.5-flare')).toHaveLength(2);
  });

  it('a rate limit waits once and then succeeds', async () => {
    const f = await makeFakes({ behavior: { 'gpt-image-2.5-sunburst': 'ratelimit-once' } });
    const out = await runSwap(f.deps, f.input());
    expect(out.result.status).toBe('done');
    expect(f.calls.filter((c) => c.model === 'gpt-image-2.5-sunburst')).toHaveLength(2);
  });

  it('a small template face triggers repair', async () => {
    const f = await makeFakes({ templateFaceBox: { left: 0.45, top: 0.1, width: 0.08, height: 0.1 } });
    const out = await runSwap(f.deps, f.input());
    if (out.result.status !== 'done') throw new Error('expected done');
    expect(out.result.ranked.some((c) => c.slot === 'repair')).toBe(true);
  });

  it('a large template face does not trigger repair', async () => {
    const f = await makeFakes();
    const out = await runSwap(f.deps, f.input());
    if (out.result.status !== 'done') throw new Error('expected done');
    expect(out.result.ranked.some((c) => c.slot === 'repair')).toBe(false);
  });

  it('a scene rerun still asks for an unchanged scene in the prompt (MachGen takes no mask)', async () => {
    const f = await makeFakes();
    await runSwap(f.deps, f.input({ maskOn: true, sceneEmphasis: true }));
    for (const c of f.calls) expect(c.prompt).toMatch(/Change nothing outside the person/);
  });

  it('a kit carried from the parent job is reused, with its photos moved to this job', async () => {
    const f = await makeFakes();
    let asked = 0;
    const build = f.deps.vision.buildKit;
    f.deps.vision.buildKit = async (...a) => (asked++, build(...a));
    const kit = { text: 'Face: round, wide, full cheeks, wide rounded jaw.', gender: 'male', ageBand: '18-29', build: 'average', refPaths: ['jobs/parent/in/user-1.jpg', 'jobs/parent/in/user-0.jpg'] };
    const input = { ...f.input(), kit };
    const prep = await prepareInputs(f.deps, input);
    const an = await analyze(f.deps, input, prep);
    // The same words on a rerun keep the face shape the user liked.
    expect(asked).toBe(0);
    expect(an.kit.text).toBe(kit.text);
    expect(an.kit.refPaths).toEqual(['jobs/job1/in/user-1.jpg', 'jobs/job1/in/user-0.jpg']);
  });
});
