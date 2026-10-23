import type { CacheMode } from './cache';
import { routeImages, type ImageProvider } from './images';
import { createMachGen } from './machgen';
import { createGemini, type VisionProvider } from './gemini';
import { createXkiroClient } from './xkiro';
import { createRekognition, createRekognitionClient, type FaceProvider } from './rekognition';

export type Providers = { faces: FaceProvider; vision: VisionProvider; images: ImageProvider };

/** Providers from env. In replay mode no key is needed: every answer comes from the cache. */
export function createProviders(opts: { mode: CacheMode; cacheDir: string; env?: NodeJS.ProcessEnv }): Providers {
  const env = opts.env ?? process.env;
  const need = (key: string) => {
    const v = env[key];
    if (!v && opts.mode !== 'replay') throw new Error(`missing env ${key}`);
    return v ?? 'replay';
  };
  return {
    faces: createRekognition({
      client: createRekognitionClient(env.AWS_REGION ?? 'us-east-1'),
      mode: opts.mode,
      cacheDir: opts.cacheDir,
    }),
    // Vision calls (kit, scene mood, body check) go to Qwen on xKiro through a Gemini-shaped adapter; the prompts,
    // schemas and answer checks in ./gemini are unchanged. Free tier: a daily token allowance, then 429.
    vision: createGemini({
      client: createXkiroClient({ apiKey: need('XKIRO_API_KEY') }) as never,
      model: env.VISION_MODEL ?? 'qwen/qwen3.8-max:free',
      fallbackModels: ['qwen/qwen3-vl-plus:free', 'qwen/qwen3.7-flash:free', 'qwen/qwen3.5-omni-flash:free'],
      mode: opts.mode,
      cacheDir: opts.cacheDir,
    }),
    images: (() => {
      const machgen = createMachGen({ mode: opts.mode, cacheDir: opts.cacheDir, apiKey: need('MACHGEN_API_KEY') });
      // Both routes run on MachGen. Child photos never reach an OpenAI or Google model (see modelsFor).
      return routeImages({
        'gpt-image-2.5-flare': machgen,
        'gpt-image-2.5-sunburst': machgen,
        'seedream-5-lite': machgen,
        'flux-2-dev': machgen,
      });
    })(),
  };
}
