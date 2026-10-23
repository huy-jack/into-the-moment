import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { FatalError, RateLimitError, RefusalError, TimeoutError } from '@/src/errors';
import type { Deps } from '@/src/pipeline/deps';
import type { GenerateRequest } from '@/src/providers/images';
import { createMemoryLedger } from '@/src/ledger/memoryLedger';
import { createLocalStore } from '@/src/store/localStore';
import { DEFAULT_OPTIONS, type Box, type FaceInfo, type JobInput, type JobOptions, type ModelId } from '@/src/types';

export type Behavior = 'ok' | 'refuse' | 'timeout' | 'fatal' | 'ratelimit-once' | 'crash-after-submit-once';

export const TEMPLATE_W = 600;
export const TEMPLATE_H = 800;

export type FakeConfig = {
  templateAge?: number;
  userAge?: number;
  templateFaceBox?: Box | null;
  extraTemplateFaces?: FaceInfo[];
  compareThrows?: boolean;
  bodyCheckThrows?: boolean;
  persons?: Box[];
  behavior?: Partial<Record<ModelId, Behavior>>;
  score?: number;
  bodyPass?: boolean;
  faceShapeMatch?: boolean;
  spendCapUsd?: number;
  imageUsd?: number;
  faceT?: number;
  /** Models with no provider, for example a child model whose provider was removed. */
  unsupported?: ModelId[];
};

export async function makeFakes(cfg: FakeConfig = {}) {
  const root = await mkdtemp(path.join(tmpdir(), 'swap-'));
  const store = createLocalStore(root);
  const ledger = createMemoryLedger();
  const calls: GenerateRequest[] = [];
  const resumed: string[] = [];
  const compareInputs: Buffer[] = [];
  const rateLimited = new Set<ModelId>();
  const crashed = new Set<ModelId>();

  const solid = (w: number, h: number, r: number) =>
    sharp({ create: { width: w, height: h, channels: 3, background: { r, g: 90, b: 60 } } }).jpeg().toBuffer();

  await store.put('uploads/template.jpg', await solid(TEMPLATE_W, TEMPLATE_H, 10));
  await store.put('uploads/u1.jpg', await solid(700, 700, 200));
  await store.put('uploads/u2.jpg', await solid(700, 700, 210));

  const faceBox = cfg.templateFaceBox === undefined ? { left: 0.4, top: 0.1, width: 0.2, height: 0.3 } : cfg.templateFaceBox;

  const deps: Deps = {
    faces: {
      async detectFaces(img) {
        const { width } = await sharp(img).metadata();
        if (width === TEMPLATE_W) {
          const main = faceBox ? [{ box: faceBox, ageLow: cfg.templateAge ?? 30, ageHigh: (cfg.templateAge ?? 30) + 8, sharpness: 90 }] : [];
          return [...main, ...(cfg.extraTemplateFaces ?? [])];
        }
        return [{ box: { left: 0.3, top: 0.2, width: 0.4, height: 0.4 }, ageLow: cfg.userAge ?? 28, ageHigh: (cfg.userAge ?? 28) + 8, sharpness: 90 }];
      },
      detectPersons: async () => cfg.persons ?? [{ left: 0.2, top: 0.05, width: 0.6, height: 0.9 }],
      compare: async (_ref, target) => {
        compareInputs.push(target);
        if (cfg.compareThrows) throw Object.assign(new Error('image too large'), { name: 'ImageTooLargeException' });
        return cfg.score ?? 90;
      },
    },
    vision: {
      buildKit: async (_refs, refPaths) => ({ text: 'a person', gender: 'female', ageBand: '18-29', build: 'slim', refPaths }),
      readScene: async () => ({
        text: 'jumps off a pier',
        expression: 'laughing',
        personGender: 'male',
        personAgeBand: '18-29',
        personBuild: 'athletic',
      }),
      bodyCheck: async () => {
        if (cfg.bodyCheckThrows) throw new FatalError('PROVIDER_ERROR', 'gemini safety block');
        return {
        genderMatch: cfg.bodyPass ?? true,
        ageBandMatch: true,
        buildMatch: true,
        faceShapeMatch: cfg.faceShapeMatch ?? true,
        stillTemplatePerson: false,
        reasons: '',
        };
      },
    },
    images: {
      supports: (model) => !(cfg.unsupported ?? []).includes(model),
      async generate(req, resume) {
        if (resume?.request) {
          resumed.push(resume.request.taskId);
          return { image: await solid(req.size.width, req.size.height, 120), usd: 0.1 };
        }
        calls.push(req);
        const b = cfg.behavior?.[req.model] ?? 'ok';
        // A rate limit on submit means the provider never accepted (or billed) the job.
        if (b === 'ratelimit-once' && !rateLimited.has(req.model)) {
          rateLimited.add(req.model);
          throw new RateLimitError(5);
        }
        await resume?.onSubmitted?.({ taskId: `r${calls.length}` });
        if (b === 'crash-after-submit-once' && !crashed.has(req.model)) {
          crashed.add(req.model);
          throw new Error('function crashed after the provider accepted the job');
        }
        if (b === 'refuse') throw new RefusalError(`${req.model} refused: minor`);
        if (b === 'timeout') throw new TimeoutError();
        if (b === 'fatal') throw new FatalError('PROVIDER_ERROR', 'no image');
        return { image: await solid(req.size.width, req.size.height, 120), usd: cfg.imageUsd ?? 0.1 };
      },
    },
    store,
    ledger,
    spendCapUsd: cfg.spendCapUsd ?? 100,
    faceT: cfg.faceT ?? 80,
    log: () => {},
    sleep: async () => {},
  };

  const input = (options: Partial<JobOptions> = {}): JobInput => ({
    jobId: 'job1',
    templatePath: 'uploads/template.jpg',
    userPaths: ['uploads/u1.jpg', 'uploads/u2.jpg'],
    options: { ...DEFAULT_OPTIONS, ...options },
  });

  return { deps, store, ledger, calls, resumed, compareInputs, input };
}
