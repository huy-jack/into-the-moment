import { describe, expect, it } from 'vitest';
import { PAID_CALL_TIMEOUT_MS } from '@/src/config';
import { modelsFor } from '@/src/pipeline/route';
import { FatalError, RateLimitError, RefusalError, TimeoutError } from '@/src/errors';
import { routeImages, type GenerateRequest, type ImageProvider, type SavedRequest } from '@/src/providers/images';
import { createMachGen, imageFile, snapSize, type MachGenHttp } from '@/src/providers/machgen';

const req: GenerateRequest = {
  model: 'gpt-image-2.5-flare',
  prompt: 'p',
  images: [Buffer.from('t'), Buffer.from('u')],
  size: { width: 1280, height: 848 },
  quality: 'high',
};

type Res = { status: number; body: unknown };

/** Fake MachGen API: uploads, one submit answer, status answers, the asset and the billing row. */
function fakeHttp(opts: { submit?: Res; statuses?: Res[]; billing?: Res } = {}) {
  const uploads: string[] = [];
  const posts: { path: string; body: Record<string, unknown> }[] = [];
  const gets: string[] = [];
  const statuses = opts.statuses ? [...opts.statuses] : null;
  const http: MachGenHttp = {
    async upload(buf) {
      uploads.push(buf.toString());
      return { status: 200, body: { artifact_path: `in/${buf.toString()}.jpg` } };
    },
    async post(path, body) {
      posts.push({ path, body: body as Record<string, unknown> });
      return opts.submit ?? { status: 200, body: { task_id: 't1' } };
    },
    async get(path) {
      gets.push(path);
      if (path.endsWith('/billing')) return opts.billing ?? { status: 200, body: { generation_cost_micros: 118000, net_cost_micros: 100300 } };
      return statuses ? (statuses.shift() ?? { status: 200, body: { status: 'RUNNING' } }) : { status: 200, body: { status: 'COMPLETED' } };
    },
    async getBytes(path) {
      gets.push(path);
      return { status: 200, body: Buffer.from('out') };
    },
  };
  return { http, uploads, posts, gets };
}

let clock = 0;
function make(http: MachGenHttp) {
  clock = 0;
  return createMachGen({
    mode: 'live',
    cacheDir: '',
    http,
    sleep: async (ms) => {
      clock += ms;
    },
    now: () => clock,
  });
}

describe('machgen provider', () => {
  it('uploads each image, submits once as an I2I task and returns the asset with the gross billed cost', async () => {
    const f = fakeHttp();
    const out = await make(f.http).generate(req);
    expect(f.uploads).toEqual(['t', 'u']);
    expect(f.posts).toHaveLength(1);
    expect(f.posts[0].path).toBe('/api/v0/generate');
    expect(f.posts[0].body).toMatchObject({
      model: 'GPT-Image-2.5-Flare',
      task_type: 'I2I',
      prompt: 'p',
      src_image_urls: ['@input/in/t.jpg', '@input/in/u.jpg'],
      image_config: { width: 1280, height: 848 },
      optimization_level: 'STANDARD',
    });
    expect(out.image.toString()).toBe('out');
    expect(out.usd).toBeCloseTo(0.118, 6);
  });

  it('sends sunburst under its MachGen name, and medium quality still as STANDARD (EXPRESS is the $0.002 check tier)', async () => {
    const f = fakeHttp();
    await make(f.http).generate({ ...req, model: 'gpt-image-2.5-sunburst', quality: 'medium' });
    expect(f.posts[0].body).toMatchObject({ model: 'GPT-Image-2.5-Sunburst', optimization_level: 'STANDARD' });
  });

  it('labels each upload by its real format: the repair crop is a PNG, working copies are JPEG', () => {
    expect(imageFile(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]))).toEqual({ type: 'image/png', name: 'image.png' });
    expect(imageFile(Buffer.from([0xff, 0xd8, 0xff, 0xe0]))).toEqual({ type: 'image/jpeg', name: 'image.jpg' });
    expect(imageFile(Buffer.from('RIFF....WEBP', 'latin1'))).toEqual({ type: 'image/webp', name: 'image.webp' });
  });

  it('snaps the requested size to the MachGen size with the closest aspect ratio', () => {
    expect(snapSize('gpt-image-2.5-flare', 1024, 1536)).toEqual({ width: 848, height: 1280 });
    expect(snapSize('gpt-image-2.5-flare', 1536, 1024)).toEqual({ width: 1280, height: 848 });
    expect(snapSize('gpt-image-2.5-flare', 1000, 1000)).toEqual({ width: 1280, height: 1280 });
    expect(snapSize('gpt-image-2.5-flare', 2000, 700)).toEqual({ width: 1280, height: 544 });
  });

  it('snaps child models to their own fixed size grids', () => {
    // Seedream 5.0 Lite: the 2K tier only (flat price, so the smallest tier). No 3:4, so a 3:4 portrait goes square.
    expect(snapSize('seedream-5-lite', 1536, 1024)).toEqual({ width: 2304, height: 1728 });
    expect(snapSize('seedream-5-lite', 1024, 1536)).toEqual({ width: 1600, height: 2848 });
    expect(snapSize('seedream-5-lite', 1056, 1408)).toEqual({ width: 2048, height: 2048 });
    expect(snapSize('seedream-5-lite', 2000, 1100)).toEqual({ width: 2848, height: 1600 });
    // FLUX.2 dev: the three 1 MP sizes only. No 16:9 landscape, so a wide template goes 4:3.
    expect(snapSize('flux-2-dev', 1536, 1024)).toEqual({ width: 1024, height: 768 });
    expect(snapSize('flux-2-dev', 1000, 1000)).toEqual({ width: 1024, height: 1024 });
    expect(snapSize('flux-2-dev', 1024, 1536)).toEqual({ width: 1024, height: 1808 });
    expect(snapSize('flux-2-dev', 2000, 1100)).toEqual({ width: 1024, height: 768 });
  });

  it('sends Seedream 5.0 Lite under its MachGen name with a 2K size and no GPT quality tier', async () => {
    const f = fakeHttp({ billing: { status: 200, body: { generation_cost_micros: 38000 } } });
    const out = await make(f.http).generate({ ...req, model: 'seedream-5-lite' });
    expect(f.posts[0].body).toMatchObject({
      model: 'Seedream-5.0-lite',
      task_type: 'I2I',
      src_image_urls: ['@input/in/t.jpg', '@input/in/u.jpg'],
      image_config: { width: 2304, height: 1728 },
    });
    expect(f.posts[0].body).not.toHaveProperty('optimization_level');
    expect(out.usd).toBeCloseTo(0.038, 6);
  });

  it('sends FLUX.2 dev under its MachGen name, at most 3 images, with no GPT quality tier', async () => {
    const f = fakeHttp({ billing: { status: 500, body: null } });
    const images = ['t', 'u1', 'u2', 'u3', 'u4'].map((s) => Buffer.from(s));
    const out = await make(f.http).generate({ ...req, model: 'flux-2-dev', images });
    expect(f.uploads).toEqual(['t', 'u1', 'u2']);
    expect(f.posts[0].body).toMatchObject({ model: 'FLUX.2-dev', task_type: 'I2I', image_config: { width: 1024, height: 768 } });
    expect(f.posts[0].body).not.toHaveProperty('optimization_level');
    // No billing row: the estimate on the snapped size, $0.004 per output megapixel.
    expect(out.usd).toBeCloseTo(0.004 * 1024 * 768 / 1e6, 6);
  });

  it('never sends a child-route model to an OpenAI or Google model on MachGen', async () => {
    for (const swap of [false, true]) {
      const { a, b, fallbacks } = modelsFor('child', swap);
      for (const model of [a, b, ...fallbacks]) {
        const f = fakeHttp();
        await make(f.http).generate({ ...req, model });
        expect(String(f.posts[0].body.model)).not.toMatch(/gpt|openai|dall|nano-banana|gemini|imagen|google/i);
      }
    }
  });

  it('saves the task id before polling, and resumes a saved task without a new upload or submit', async () => {
    const f = fakeHttp();
    const saved: SavedRequest[] = [];
    await make(f.http).generate(req, { onSubmitted: async (r) => void saved.push(r) });
    expect(saved).toEqual([{ taskId: 't1' }]);

    const g = fakeHttp();
    await make(g.http).generate(req, { request: saved[0] });
    expect(g.uploads).toHaveLength(0);
    expect(g.posts).toHaveLength(0);
    expect(g.gets).toContain('/api/v0/assets/t1');
  });

  it('does not retry a failed submit (a resubmit can charge twice)', async () => {
    const f = fakeHttp({ submit: { status: 504, body: { detail: 'gateway timeout' } } });
    const err = await make(f.http).generate(req).catch((e) => e);
    expect(err).toBeInstanceOf(FatalError);
    expect(f.posts).toHaveLength(1);
  });

  it('says the MachGen wallet needs a top-up on 402', async () => {
    const f = fakeHttp({ submit: { status: 402, body: { detail: 'Your balance is too low for this generation.' } } });
    const err = await make(f.http).generate(req).catch((e) => e);
    expect(err).toBeInstanceOf(FatalError);
    expect((err as Error).message).toMatch(/top up the MachGen wallet/);
  });

  it('maps 429 on submit to a rate limit', async () => {
    const f = fakeHttp({ submit: { status: 429, body: {} } });
    await expect(make(f.http).generate(req)).rejects.toBeInstanceOf(RateLimitError);
  });

  it('maps a moderation block at admission to a refusal', async () => {
    const f = fakeHttp({ submit: { status: 200, body: { task_id: 't1', moderation: { flagged: true, categories: ['minors'] } } } });
    await expect(make(f.http).generate(req)).rejects.toBeInstanceOf(RefusalError);
  });

  it('maps a FAILED task with a moderation verdict to a refusal, and other failures to a provider error', async () => {
    const blocked = fakeHttp({ statuses: [{ status: 200, body: { status: 'FAILED', error_msg: 'blocked', moderation: { flagged: true } } }] });
    await expect(make(blocked.http).generate(req)).rejects.toBeInstanceOf(RefusalError);
    const broken = fakeHttp({ statuses: [{ status: 200, body: { status: 'FAILED', error_msg: 'vendor error' } }] });
    await expect(make(broken.http).generate(req)).rejects.toBeInstanceOf(FatalError);
  });

  it('stops polling at the paid-call timeout', async () => {
    const f = fakeHttp({ statuses: Array.from({ length: 1000 }, () => ({ status: 200, body: { status: 'RUNNING' } })) });
    await expect(make(f.http).generate(req)).rejects.toBeInstanceOf(TimeoutError);
    expect(clock).toBeGreaterThanOrEqual(PAID_CALL_TIMEOUT_MS);
  });

  it('falls back to the price estimate when the billing row cannot be read', async () => {
    const f = fakeHttp({ billing: { status: 500, body: null } });
    const out = await make(f.http).generate(req);
    expect(out.usd).toBeCloseTo(0.118, 6);
  });

  it('supports the two GPT Image 2.5 models and both child models', () => {
    const p = make(fakeHttp().http);
    expect(p.supports('gpt-image-2.5-flare')).toBe(true);
    expect(p.supports('gpt-image-2.5-sunburst')).toBe(true);
    expect(p.supports('seedream-5-lite')).toBe(true);
    expect(p.supports('flux-2-dev')).toBe(true);
  });
});

describe('routeImages', () => {
  const ok: ImageProvider = { supports: () => true, generate: async () => ({ image: Buffer.from('x'), usd: 0 }) };

  it('sends each model to the provider that owns it', async () => {
    const images = routeImages({ 'gpt-image-2.5-flare': ok });
    expect(images.supports('gpt-image-2.5-flare')).toBe(true);
    expect((await images.generate(req)).image.toString()).toBe('x');
  });

  it('marks a model with no provider as unsupported and refuses to call it', async () => {
    const images = routeImages({ 'gpt-image-2.5-flare': ok });
    expect(images.supports('seedream-5-lite')).toBe(false);
    const err = await images.generate({ ...req, model: 'seedream-5-lite' }).catch((e) => e);
    expect(err).toBeInstanceOf(FatalError);
    expect((err as FatalError).code).toBe('CHILD_UNSUPPORTED');
  });
});
