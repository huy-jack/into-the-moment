import path from 'node:path';
import sharp from 'sharp';
import { REPAIR_CROP_PAD } from '../config';
import { FatalError, RefusalError, SpendCapError, TimeoutError, type ErrorCode } from '../errors';
import { cropBox, outputSize, pasteBack, workingCopy } from '../lib/image';
import { estimateUsd, GEMINI_USD, REKOGNITION_USD } from '../providers/prices';
import type { Box, Candidate, FaceInfo, IdentityKit, JobInput, ModelId, Route, SceneCard, Slot } from '../types';
import { paid, type Deps } from './deps';
import { gateUserPhoto } from './gate';
import { buildPrompt, buildRepairPrompt } from './prompt';
import { meanScore, rankCandidates } from './rank';
import { chooseRoute, modelsFor } from './route';

export type Prepared = {
  users: { path: string; face: FaceInfo }[];
  rejected: { path: string; code: ErrorCode }[];
  template: { path: string; width: number; height: number; faceBox: Box | null; personBox: Box; ageLow: number };
};

export type Analysis = {
  kit: IdentityKit;
  scene: SceneCard;
  route: Route;
  models: ReturnType<typeof modelsFor>;
};

export type Final = { status: 'done'; ranked: Candidate[] } | { status: 'failed'; code: ErrorCode; ranked: Candidate[] };

/** Inputs per call for each model, template included (GPT Image 2.5 as listed on fal; child models from MachGen). */
const MAX_IMAGES: Record<ModelId, number> = {
  'gpt-image-2.5-flare': 16,
  'gpt-image-2.5-sunburst': 16,
  'seedream-5-lite': 14,
  'flux-2-dev': 3,
};

const rek = (jobId: string, step: string) => ({ jobId, step, attempt: 1, provider: 'rekognition', estimateUsd: REKOGNITION_USD });
const gem = (jobId: string, step: string) => ({ jobId, step, attempt: 1, provider: 'gemini', estimateUsd: GEMINI_USD });

const center = (b: Box) => ({ x: b.left + b.width / 2, y: b.top + b.height / 2 });
const inside = (p: { x: number; y: number }, b: Box) =>
  p.x >= b.left && p.x <= b.left + b.width && p.y >= b.top && p.y <= b.top + b.height;

/** Working copies, photo gate, the template's largest person and that person's face. */
export async function prepareInputs(deps: Deps, input: JobInput): Promise<Prepared> {
  const { jobId } = input;

  const tpl = await workingCopy(await deps.store.get(input.templatePath));
  const templatePath = `jobs/${jobId}/in/template.jpg`;
  await deps.store.put(templatePath, tpl.buf);
  const persons = await paid(deps, rek(jobId, 'template-persons'), () => deps.faces.detectPersons(tpl.buf));
  if (persons.length === 0) throw new FatalError('NO_PERSON');
  const personBox = persons[0];
  const tplFaces = await paid(deps, rek(jobId, 'template-faces'), () => deps.faces.detectFaces(tpl.buf));
  // The face to swap and repair: only a face inside the main person's box, never a bystander's.
  const face = tplFaces.find((f) => inside(center(f.box), personBox));

  const users: Prepared['users'] = [];
  const rejected: Prepared['rejected'] = [];
  for (const [i, p] of input.userPaths.entries()) {
    const wc = await workingCopy(await deps.store.get(p));
    const path = `jobs/${jobId}/in/user-${i}.jpg`;
    await deps.store.put(path, wc.buf);
    const faces = await paid(deps, rek(jobId, `user-${i}-faces`), () => deps.faces.detectFaces(wc.buf));
    const gate = gateUserPhoto(faces, wc.width, wc.height);
    if (gate.ok) users.push({ path, face: faces[0] });
    else rejected.push({ path: p, code: gate.code });
  }
  if (users.length === 0) throw new FatalError(rejected[0]?.code ?? 'NO_FACE');

  return {
    users,
    rejected,
    template: {
      path: templatePath,
      width: tpl.width,
      height: tpl.height,
      faceBox: face?.box ?? null,
      personBox,
      // Routing uses the youngest face anywhere in the template: a child beside an adult still
      // means a child photo. No visible main face means no age estimate: the safe side is child.
      ageLow: face ? Math.min(...tplFaces.map((f) => f.ageLow)) : 0,
    },
  };
}

/** A parent job's kit, with its photo paths moved to this job's copies of the same photos. */
function carriedKit(kit: IdentityKit, prep: Prepared): IdentityKit {
  const byName = new Map(prep.users.map((u) => [path.posix.basename(u.path), u.path]));
  const refPaths = kit.refPaths.flatMap((p) => byName.get(path.posix.basename(p)) ?? []);
  return { ...kit, refPaths: refPaths.length ? refPaths : [prep.users[0].path] };
}

export async function analyze(deps: Deps, input: JobInput, prep: Prepared): Promise<Analysis> {
  const refs = await Promise.all(prep.users.map((u) => deps.store.get(u.path)));
  const template = await deps.store.get(prep.template.path);
  const [kit, scene] = await Promise.all([
    input.kit
      ? carriedKit(input.kit, prep)
      : paid(deps, gem(input.jobId, 'kit'), () => deps.vision.buildKit(refs, prep.users.map((u) => u.path))),
    paid(deps, gem(input.jobId, 'scene'), () => deps.vision.readScene(template)),
  ]);
  const route = chooseRoute([prep.template.ageLow, ...prep.users.map((u) => u.face.ageLow)]);
  const models = modelsFor(route, input.options.swapAdultOrder);
  // Every model in the list needs a provider, checked here before any paid image call is reserved: an unsupported
  // A or B would keep a reservation it never settles. Reached when a child model loses its provider.
  if (![models.a, models.b, ...models.fallbacks].every((m) => deps.images.supports(m))) throw new FatalError('CHILD_UNSUPPORTED');
  return { kit, scene, route, models };
}

const blank = (slot: Slot, model: ModelId, attempt: number): Candidate => ({
  slot,
  model,
  attempt,
  path: null,
  refused: false,
  refusalText: null,
  failed: false,
  bodyCheck: null,
  score: null,
});

/**
 * One version. Writes to jobs/{jobId}/{slot}-{attempt}.png and skips the paid call when that
 * file exists (runner replay). Refusal, timeout and provider errors become a marked candidate;
 * RateLimitError and SpendCapError propagate.
 */
export async function generateVersion(
  deps: Deps,
  input: JobInput,
  prep: Prepared,
  an: Analysis,
  slot: Slot,
  model: ModelId,
  attempt: number,
): Promise<Candidate> {
  const out = `jobs/${input.jobId}/${slot}-${attempt}.png`;
  const c = blank(slot, model, attempt);
  if (await deps.store.exists(out)) return { ...c, path: out };
  const resume = await resumeFor(deps, `jobs/${input.jobId}/${slot}-${attempt}.req`);

  const template = await deps.store.get(prep.template.path);
  const refPaths = an.kit.refPaths.slice(0, MAX_IMAGES[model] - 1);
  const refs = await Promise.all(refPaths.map((p) => deps.store.get(p)));
  const size = outputSize(prep.template.width, prep.template.height);
  const images = [template, ...refs];
  const estimate = estimateUsd(model, { quality: input.options.quality, inputCount: images.length, megapixels: (size.width * size.height) / 1e6 });

  try {
    const res = await paid(deps, { jobId: input.jobId, step: `generate-${slot}`, attempt, provider: model, estimateUsd: estimate }, () =>
      deps.images.generate(
        {
          model,
          prompt: buildPrompt(an.kit, an.scene, refs.length, input.options),
          images,
          size,
          quality: input.options.quality,
        },
        resume,
      ),
    );
    await deps.store.put(out, res.image);
    return { ...c, path: out };
  } catch (err) {
    const marked = markFailure(c, err);
    if (!marked) throw err;
    deps.log(`${slot}-${attempt} ${model}: ${(err as Error).message}`);
    return marked;
  }
}

/** Refusal, timeout, provider error and spend cap become a marked version; other errors propagate. */
function markFailure(c: Candidate, err: unknown): Candidate | null {
  if (err instanceof RefusalError) return { ...c, refused: true, refusalText: err.text };
  if (err instanceof SpendCapError) return { ...c, failed: true, error: 'SPEND_CAP' };
  if (err instanceof TimeoutError) return { ...c, failed: true, error: 'TIMEOUT' };
  if (err instanceof FatalError) return { ...c, failed: true, error: err.code };
  return null;
}

/**
 * The provider request id is saved before polling. A replay after a crash finds it and resumes
 * that request: the provider already billed it once.
 */
async function resumeFor(deps: Deps, reqPath: string) {
  const request = (await deps.store.exists(reqPath)) ? JSON.parse((await deps.store.get(reqPath)).toString()) : undefined;
  return { request, onSubmitted: (r: unknown) => deps.store.put(reqPath, Buffer.from(JSON.stringify(r))) };
}

/** Body check plus the mean CompareFaces score over all refs. */
export async function evaluate(deps: Deps, input: JobInput, prep: Prepared, an: Analysis, c: Candidate): Promise<Candidate> {
  if (!c.path) return c;
  // A JPEG working copy: raw provider PNGs can pass Rekognition's 5 MB limit.
  const result = (await workingCopy(await deps.store.get(c.path))).buf;
  const refs = await Promise.all(an.kit.refPaths.map((p) => deps.store.get(p)));
  const template = await deps.store.get(prep.template.path);
  const tag = `${c.slot}-${c.attempt}`;
  // Checks never cost the user a paid version: a failed check leaves that field empty.
  const soft = async <T>(what: string, fn: () => Promise<T>): Promise<T | null> => {
    try {
      return await fn();
    } catch (err) {
      deps.log(`${tag} ${what} skipped: ${(err as Error).message}`);
      return null;
    }
  };
  const [bodyCheck, scores] = await Promise.all([
    soft('body check', () => paid(deps, gem(input.jobId, `body-${tag}`), () => deps.vision.bodyCheck(result, refs, template))),
    Promise.all(
      refs.map((r, i) => soft('face score', () => paid(deps, rek(input.jobId, `score-${tag}-${i}`), () => deps.faces.compare(r, result)))),
    ),
  ]);
  return { ...c, bodyCheck, score: meanScore(scores) };
}

/** Regenerate only the face crop of `best` from the original refs, then paste it back. */
export async function repair(deps: Deps, input: JobInput, prep: Prepared, an: Analysis, best: Candidate): Promise<Candidate> {
  const out = `jobs/${input.jobId}/repair-1.png`;
  const c = blank('repair', best.model, 1);
  if (await deps.store.exists(out)) return { ...c, path: out };
  if (!best.path || !prep.template.faceBox) return { ...c, failed: true };
  const resume = await resumeFor(deps, `jobs/${input.jobId}/repair-1.req`);

  const result = await deps.store.get(best.path);
  const { buf: crop, pixelBox } = await cropBox(result, prep.template.faceBox, REPAIR_CROP_PAD);
  const meta = await sharp(crop).metadata();
  const size = outputSize(meta.width!, meta.height!);
  const refPaths = an.kit.refPaths.slice(0, MAX_IMAGES[best.model] - 1);
  const refs = await Promise.all(refPaths.map((p) => deps.store.get(p)));
  const estimate = estimateUsd(best.model, { quality: input.options.quality, inputCount: refs.length + 1, megapixels: (size.width * size.height) / 1e6 });
  try {
    const res = await paid(deps, { jobId: input.jobId, step: 'repair', attempt: 1, provider: best.model, estimateUsd: estimate }, () =>
      deps.images.generate(
        {
          model: best.model,
          prompt: buildRepairPrompt(an.kit, an.scene, refs.length),
          images: [crop, ...refs],
          size,
          quality: input.options.quality,
        },
        resume,
      ),
    );
    await deps.store.put(out, await pasteBack(result, res.image, pixelBox));
    return { ...c, path: out };
  } catch (err) {
    const marked = markFailure(c, err);
    if (!marked) throw err;
    deps.log(`repair-1 ${best.model}: ${(err as Error).message}`);
    return marked;
  }
}

export function finalize(cs: Candidate[]): Final {
  const ranked = rankCandidates(cs);
  if (ranked.some((c) => c.path)) return { status: 'done', ranked };
  const code: ErrorCode =
    cs.length > 0 && cs.every((c) => c.refused)
      ? 'REFUSED_ALL'
      : cs.some((c) => c.error === 'SPEND_CAP')
        ? 'SPEND_CAP'
        : cs.some((c) => c.refused)
          ? 'REFUSED_ALL'
          : (cs.find((c) => c.error)?.error ?? 'PROVIDER_ERROR');
  return { status: 'failed', code, ranked };
}
