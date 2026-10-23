import { describe, expect, it } from 'vitest';
import { gateUserPhoto } from '@/src/pipeline/gate';
import { buildPrompt, buildRepairPrompt, isVisibleBody } from '@/src/pipeline/prompt';
import { bodyPass, meanScore, needsRepair, needsRetry, optionsForProblem, rankCandidates } from '@/src/pipeline/rank';
import { chooseRoute, modelsFor } from '@/src/pipeline/route';
import { DEFAULT_OPTIONS, type Candidate, type FaceInfo, type IdentityKit, type SceneCard } from '@/src/types';

const face = (over: Partial<FaceInfo> = {}): FaceInfo => ({
  box: { left: 0.3, top: 0.2, width: 0.3, height: 0.3 },
  ageLow: 25,
  ageHigh: 33,
  sharpness: 80,
  ...over,
});

describe('gateUserPhoto', () => {
  it('passes a sharp 1024x1024 single face of 300 px', () => {
    expect(gateUserPhoto([face()], 1024, 1024)).toEqual({ ok: true });
  });
  it('NO_FACE for 0 faces', () => expect(gateUserPhoto([], 1024, 1024)).toEqual({ ok: false, code: 'NO_FACE' }));
  it('MULTI_FACE for 2 faces', () =>
    expect(gateUserPhoto([face(), face()], 1024, 1024)).toEqual({ ok: false, code: 'MULTI_FACE' }));
  it('LOW_RES for a short side under 512', () =>
    expect(gateUserPhoto([face()], 500, 1024)).toEqual({ ok: false, code: 'LOW_RES' }));
  it('FACE_TOO_SMALL under 128 px', () =>
    expect(gateUserPhoto([face({ box: { left: 0, top: 0, width: 0.1, height: 0.1 } })], 1024, 1024)).toEqual({
      ok: false,
      code: 'FACE_TOO_SMALL',
    }));
  it('BLURRY under sharpness 20', () =>
    expect(gateUserPhoto([face({ sharpness: 10 })], 1024, 1024)).toEqual({ ok: false, code: 'BLURRY' }));
});

describe('route', () => {
  it('a borderline young adult read as 16 sends the job to the child route', () => {
    expect(chooseRoute([30, 16])).toBe('child');
  });
  it('adults stay on the adult route', () => expect(chooseRoute([25, 40])).toBe('adult'));
  it('child route never contains an OpenAI or Google model', () => {
    for (const swap of [false, true]) {
      const m = modelsFor('child', swap);
      expect([m.a, m.b, ...m.fallbacks]).not.toContain('gpt-image-2.5-flare');
      expect([m.a, m.b, ...m.fallbacks]).not.toContain('gpt-image-2.5-sunburst');
      for (const id of [m.a, m.b, ...m.fallbacks]) expect(id).not.toMatch(/gpt|openai|nano-banana|gemini|imagen|google/i);
    }
  });
  it('child route is Seedream 5.0 Lite then FLUX.2 dev, with no fallbacks', () => {
    expect(modelsFor('child', false)).toEqual({ a: 'seedream-5-lite', b: 'flux-2-dev', fallbacks: [] });
    expect(modelsFor('child', true)).toEqual({ a: 'seedream-5-lite', b: 'flux-2-dev', fallbacks: [] });
  });
  it('adult route uses flare then sunburst, swapped on request', () => {
    expect(modelsFor('adult', false)).toMatchObject({ a: 'gpt-image-2.5-flare', b: 'gpt-image-2.5-sunburst' });
    expect(modelsFor('adult', true)).toMatchObject({ a: 'gpt-image-2.5-sunburst', b: 'gpt-image-2.5-flare' });
  });
  it('auto-routes square jaw or elderly to sunburst first', () => {
    expect(modelsFor('adult', false, { ageBand: 'elderly' })).toMatchObject({ a: 'gpt-image-2.5-sunburst', b: 'gpt-image-2.5-flare' });
    expect(modelsFor('adult', false, { text: 'man with a strong square jaw and grey hair' })).toMatchObject({ a: 'gpt-image-2.5-sunburst', b: 'gpt-image-2.5-flare' });
  });
});

const kit: IdentityKit = { text: 'a woman', gender: 'female', ageBand: '30-44', build: 'slim', refPaths: ['a', 'b', 'c'] };
const scene: SceneCard = {
  text: 'jumps off a pier',
  expression: 'laughing',
  personGender: 'male',
  personAgeBand: '30-44',
  personBuild: 'athletic',
};

describe('buildPrompt', () => {
  it('names image roles, the replacement and the keep list', () => {
    const p = buildPrompt(kit, scene, 3, DEFAULT_OPTIONS);
    expect(p).toContain('Image 1 is the scene. Images 2 to 4 are the person.');
    expect(p).toContain('Replace the person in Image 1');
    expect(p).toContain('The person in Images 2 to 4: a woman');
    for (const word of ['pose', 'objects', 'camera', 'light']) expect(p).toContain(word);
    expect(p).toContain('Scene: jumps off a pier');
  });
  it('adds the body note when gender differs, and leaves it out when they match', () => {
    const note = 'Use the body of the person in Images 2 to 4';
    expect(buildPrompt(kit, scene, 3, DEFAULT_OPTIONS)).toContain(note);
    expect(buildPrompt(kit, { ...scene, personGender: 'female' }, 3, DEFAULT_OPTIONS)).not.toContain(note);
  });
  it('names a single reference as Image 2', () => {
    expect(buildPrompt(kit, scene, 1, DEFAULT_OPTIONS)).toContain('Image 2 is the person');
  });
  it('asks for an unchanged scene only on a scene rerun', () => {
    expect(buildPrompt(kit, scene, 3, DEFAULT_OPTIONS)).not.toContain('Change nothing outside the person');
    expect(buildPrompt(kit, scene, 3, { ...DEFAULT_OPTIONS, sceneEmphasis: true })).toContain('Change nothing outside the person');
  });
});

describe('isVisibleBody', () => {
  it('follows the kit flag', () => {
    expect(isVisibleBody({ ...kit, hasVisibleBody: true })).toBe(true);
    expect(isVisibleBody({ ...kit, hasVisibleBody: false })).toBe(false);
    expect(isVisibleBody(kit)).toBe(false);
  });
});

describe('buildRepairPrompt', () => {
  it('names the crop and the person', () => {
    const p = buildRepairPrompt(kit, scene, 3);
    expect(p).toContain('Image 1 is a close crop around a face. Images 2 to 4 are the person.');
    expect(p).toContain('as the person in Images 2 to 4: a woman');
  });
});

const cand = (over: Partial<Candidate>): Candidate => ({
  slot: 'a',
  model: 'gpt-image-2.5-flare',
  attempt: 1,
  path: 'x.png',
  refused: false,
  refusalText: null,
  failed: false,
  bodyCheck: { genderMatch: true, ageBandMatch: true, buildMatch: true, faceShapeMatch: true, stillTemplatePerson: false, reasons: '' },
  score: 80,
  ...over,
});
const failBody = { genderMatch: false, ageBandMatch: true, buildMatch: true, faceShapeMatch: true, stillTemplatePerson: false, reasons: '' };

describe('rank and decisions', () => {
  it('a body-failing version with score 95 ranks below a passing version with score 70', () => {
    const ranked = rankCandidates([cand({ slot: 'a', score: 95, bodyCheck: failBody }), cand({ slot: 'b', score: 70 })]);
    expect(ranked.map((c) => c.slot)).toEqual(['b', 'a']);
  });
  it('refused versions rank last', () => {
    const ranked = rankCandidates([cand({ slot: 'a', refused: true, path: null, score: null }), cand({ slot: 'b', score: 10, bodyCheck: failBody })]);
    expect(ranked[1].slot).toBe('a');
  });
  it('bodyPass is false when the result still looks like the template person', () => {
    expect(bodyPass(cand({ bodyCheck: { ...failBody, genderMatch: true, stillTemplatePerson: true } }))).toBe(false);
  });
  it('a face drawn slimmer than the real person fails the body check, so the adult route retries', () => {
    const slim = cand({ score: 95, bodyCheck: { ...failBody, genderMatch: true, faceShapeMatch: false } });
    expect(bodyPass(slim)).toBe(false);
    expect(needsRetry('adult', slim, 80, 0)).toBe(true);
  });
  it('adult retry below T once only', () => {
    expect(needsRetry('adult', cand({ score: 70 }), 80, 0)).toBe(true);
    expect(needsRetry('adult', cand({ score: 70 }), 80, 1)).toBe(false);
    expect(needsRetry('adult', cand({ score: 90 }), 80, 0)).toBe(false);
    expect(needsRetry('adult', cand({ score: 90, bodyCheck: failBody }), 80, 0)).toBe(true);
  });
  it('child route has no T', () => expect(needsRetry('child', cand({ score: 10 }), 80, 0)).toBe(false));
  it('repairs faces under 15% of image height', () => {
    expect(needsRepair({ left: 0, top: 0, width: 0.1, height: 0.14 })).toBe(true);
    expect(needsRepair({ left: 0, top: 0, width: 0.1, height: 0.15 })).toBe(false);
    expect(needsRepair(null)).toBe(false);
  });
  it('meanScore counts a missing face as 0', () => {
    expect(meanScore([90, null])).toBe(45);
    expect(meanScore([null, null])).toBeNull();
  });
  it('maps quick-fix problems to options', () => {
    expect(optionsForProblem('face', DEFAULT_OPTIONS).swapAdultOrder).toBe(true);
    expect(optionsForProblem('body', DEFAULT_OPTIONS).strongBodyNote).toBe(true);
    expect(optionsForProblem('scene', DEFAULT_OPTIONS)).toMatchObject({ maskOn: true, sceneEmphasis: true });
  });
});
