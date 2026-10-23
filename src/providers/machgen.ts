import { PAID_CALL_TIMEOUT_MS, RATE_LIMIT_DEFAULT_WAIT_MS } from '../config';
import { FatalError, RateLimitError, RefusalError, TimeoutError } from '../errors';
import type { ModelId } from '../types';
import { cached, type CacheMode } from './cache';
import type { GenerateRequest, ImageProvider, Resume, SavedRequest } from './images';
import { estimateUsd } from './prices';

type HttpRes = { status: number; body: unknown };

/** Plain HTTP against api.machgen.ai. Submit is sent once and never retried: a resubmit can bill twice. */
export type MachGenHttp = {
  upload(buf: Buffer): Promise<HttpRes>;
  post(path: string, body: unknown): Promise<HttpRes>;
  get(path: string): Promise<HttpRes>;
  getBytes(path: string): Promise<{ status: number; body: Buffer }>;
};

type Size = { width: number; height: number };

/** Output sizes from the MachGen pricing page, 2 MP or less. Only 1280x848 has been run. */
const GPT_SIZES: Size[] = [
  { width: 1280, height: 544 },
  { width: 1280, height: 720 },
  { width: 720, height: 1280 },
  { width: 1280, height: 848 },
  { width: 848, height: 1280 },
  { width: 1280, height: 960 },
  { width: 960, height: 1280 },
  { width: 1280, height: 1280 },
];

/**
 * How MachGen takes each model it sells. maxInputs counts the template. optimizationLevel is sent only where its
 * meaning is documented (GPT Image); the docs say an unset level gets the model's default.
 */
type ModelSpec = { name: string; sizes: Size[]; maxInputs: number; optimizationLevel?: 'STANDARD' };

const MODELS: Partial<Record<ModelId, ModelSpec>> = {
  // Both job qualities use STANDARD: EXPRESS was never measured for image quality. 16 inputs is fal's figure.
  'gpt-image-2.5-flare': { name: 'GPT-Image-2.5-Flare', sizes: GPT_SIZES, maxInputs: 16, optimizationLevel: 'STANDARD' },
  'gpt-image-2.5-sunburst': { name: 'GPT-Image-2.5-Sunburst', sizes: GPT_SIZES, maxInputs: 16, optimizationLevel: 'STANDARD' },
  // Child route. Sizes and input limits from the model pages (machgen.ai/models/bytedance/seedream-5.0-lite and
  // /models/black-forest-labs/flux-2-dev, 2026-10-21); neither has been run live.
  // Seedream: partner pass-through to ByteDance, up to 14 inputs, exact 2K/3K/4K grids in 1:1, 4:3, 16:9, 9:16
  // only. The price is flat, so only the 2K tier is listed: larger tiers cost the same and only add bytes.
  'seedream-5-lite': {
    name: 'Seedream-5.0-lite',
    sizes: [
      { width: 2048, height: 2048 },
      { width: 2304, height: 1728 },
      { width: 2848, height: 1600 },
      { width: 1600, height: 2848 },
    ],
    maxInputs: 14,
  },
  // FLUX.2 dev: on MachGen's own GPUs, up to 3 inputs, five fixed sizes. Billed per output megapixel, so only the
  // three 1 MP sizes are listed; 2048x2048 and 2048x1536 cost 3 to 4 times more at the same aspect ratios.
  'flux-2-dev': {
    name: 'FLUX.2-dev',
    sizes: [
      { width: 1024, height: 768 },
      { width: 1024, height: 1024 },
      { width: 1024, height: 1808 },
    ],
    maxInputs: 3,
  },
};
const POLL_MS = 2000;
const BASE_URL = 'https://api.machgen.ai';

/**
 * The model's listed size whose aspect ratio is closest to the requested one. A ratio the model lacks (3:4 on both
 * child models, 16:9 landscape on FLUX) comes back reframed.
 */
export function snapSize(model: ModelId, width: number, height: number): Size {
  const want = Math.log(width / height);
  return (MODELS[model]?.sizes ?? GPT_SIZES).reduce((best, s) =>
    Math.abs(Math.log(s.width / s.height) - want) < Math.abs(Math.log(best.width / best.height) - want) ? s : best,
  );
}

/** Upload label from the file's first bytes: working copies are JPEG, the repair crop is PNG. */
export function imageFile(buf: Buffer): { type: string; name: string } {
  if (buf[0] === 0x89 && buf[1] === 0x50) return { type: 'image/png', name: 'image.png' };
  if (buf.subarray(0, 4).toString('latin1') === 'RIFF' && buf.subarray(8, 12).toString('latin1') === 'WEBP') return { type: 'image/webp', name: 'image.webp' };
  return { type: 'image/jpeg', name: 'image.jpg' };
}

function fetchHttp(apiKey: string | undefined): MachGenHttp {
  const auth = { Authorization: `Bearer ${apiKey ?? ''}` };
  const read = async (res: Response): Promise<HttpRes> => ({ status: res.status, body: await res.json().catch(() => null) });
  return {
    upload: async (buf) => {
      const file = imageFile(buf);
      const form = new FormData();
      form.append('file', new Blob([new Uint8Array(buf)], { type: file.type }), file.name);
      return read(await fetch(`${BASE_URL}/api/v0/upload`, { method: 'POST', headers: auth, body: form }));
    },
    post: async (path, body) =>
      read(await fetch(`${BASE_URL}${path}`, { method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' }, body: JSON.stringify(body) })),
    get: async (path) => read(await fetch(`${BASE_URL}${path}`, { headers: auth })),
    getBytes: async (path) => {
      const res = await fetch(`${BASE_URL}${path}`, { headers: auth });
      return { status: res.status, body: Buffer.from(await res.arrayBuffer()) };
    },
  };
}

type Moderation = { flagged?: boolean; categories?: string[] } | null | undefined;

function mapError(res: HttpRes): Error {
  if (res.status === 429) return new RateLimitError(RATE_LIMIT_DEFAULT_WAIT_MS);
  const detail = (res.body as { detail?: unknown } | null)?.detail ?? res.body ?? '';
  if (res.status === 402) return new FatalError('PROVIDER_ERROR', `machgen 402: out of credit, top up the MachGen wallet (${JSON.stringify(detail)})`);
  return new FatalError('PROVIDER_ERROR', `machgen ${res.status}: ${JSON.stringify(detail)}`);
}

const refusal = (m: Moderation, text?: string | null) =>
  new RefusalError(text || `blocked by moderation: ${(m?.categories ?? []).join(', ') || 'no category given'}`);

export function createMachGen(opts: {
  mode: CacheMode;
  cacheDir: string;
  apiKey?: string;
  http?: MachGenHttp;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
}): ImageProvider {
  const http = opts.http ?? fetchHttp(opts.apiKey);
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const now = opts.now ?? Date.now;

  async function submit(req: GenerateRequest, spec: ModelSpec, images: Buffer[], size: Size): Promise<SavedRequest> {
    const refs: string[] = [];
    for (const img of images) {
      const up = await http.upload(img);
      const artifact = (up.body as { artifact_path?: string } | null)?.artifact_path;
      if (up.status < 200 || up.status >= 300 || !artifact) throw mapError(up);
      refs.push(`@input/${artifact}`);
    }
    const res = await http.post('/api/v0/generate', {
      model: spec.name,
      task_type: 'I2I',
      prompt: req.prompt,
      src_image_urls: refs,
      image_config: size,
      ...(spec.optimizationLevel && { optimization_level: spec.optimizationLevel }),
    });
    if (res.status < 200 || res.status >= 300) throw mapError(res);
    const b = res.body as { task_id?: string; moderation?: Moderation } | null;
    if (b?.moderation?.flagged) throw refusal(b.moderation);
    if (!b?.task_id) throw new FatalError('PROVIDER_ERROR', 'machgen submit returned no task id');
    return { taskId: b.task_id };
  }

  /** Gross billed cost; the 15% credit back is not cash, so the cap counts the gross. */
  async function billedUsd(taskId: string, estimate: number): Promise<number> {
    try {
      const res = await http.get(`/api/v0/tasks/${taskId}/billing`);
      const micros = (res.body as { generation_cost_micros?: number } | null)?.generation_cost_micros;
      return res.status === 200 && typeof micros === 'number' ? micros / 1e6 : estimate;
    } catch {
      return estimate;
    }
  }

  async function call(req: GenerateRequest, resume?: Resume): Promise<{ image: Buffer; usd: number }> {
    const spec = MODELS[req.model];
    if (!spec) throw new FatalError('CHILD_UNSUPPORTED', `machgen does not sell ${req.model}`);
    const deadline = now() + PAID_CALL_TIMEOUT_MS;
    const images = req.images.slice(0, spec.maxInputs);
    const size = snapSize(req.model, req.size.width, req.size.height);
    let saved = resume?.request;
    if (!saved) {
      saved = await submit(req, spec, images, size);
      await resume?.onSubmitted?.(saved);
    }

    for (;;) {
      if (now() >= deadline) throw new TimeoutError();
      const s = await http.get(`/api/v0/tasks/${saved.taskId}`);
      const b = s.body as { status?: string; error_msg?: string | null; moderation?: Moderation } | null;
      if (b?.status === 'COMPLETED') break;
      if (b?.status === 'FAILED') {
        if (b.moderation?.flagged) throw refusal(b.moderation, b.error_msg);
        throw new FatalError('PROVIDER_ERROR', `machgen task failed: ${b.error_msg ?? 'no reason given'}`);
      }
      if (s.status >= 400 && s.status !== 429) throw mapError(s);
      await sleep(POLL_MS);
    }

    const asset = await http.getBytes(`/api/v0/assets/${saved.taskId}`);
    if (asset.status < 200 || asset.status >= 300 || asset.body.length === 0) throw new FatalError('PROVIDER_ERROR', `machgen download ${asset.status}`);
    const estimate = estimateUsd(req.model, { quality: req.quality, inputCount: images.length, megapixels: (size.width * size.height) / 1e6 });
    return { image: asset.body, usd: await billedUsd(saved.taskId, estimate) };
  }

  return {
    supports: (model) => !!MODELS[model],
    generate: (req, resume) =>
      cached(
        {
          mode: opts.mode,
          dir: opts.cacheDir,
          provider: `machgen-${req.model}`,
          payload: { prompt: req.prompt, size: req.size, quality: req.quality },
          images: req.images,
        },
        () => call(req, resume),
      ),
  };
}
