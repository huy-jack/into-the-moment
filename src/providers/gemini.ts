import type { GoogleGenAI } from '@google/genai';
import { z } from 'zod';
import { REFS_MAX } from '../config';
import { FatalError } from '../errors';
import type { BodyCheck, IdentityKit, SceneCard } from '../types';
import { cached, type CacheMode } from './cache';

export interface VisionProvider {
  buildKit(refs: Buffer[], refPaths: string[]): Promise<IdentityKit>;
  readScene(template: Buffer): Promise<SceneCard>;
  bodyCheck(result: Buffer, refs: Buffer[], template: Buffer): Promise<BodyCheck>;
}

type Client = { models: Pick<GoogleGenAI['models'], 'generateContent'> };

const KitSchema = z.object({
  text: z.string(),
  gender: z.string(),
  ageBand: z.string(),
  build: z.string(),
  hasVisibleBody: z.boolean().optional(),
  nationality: z.string().optional(),
  bestRefIndexes: z.array(z.number().int().min(0)),
});

const SceneSchema = z.object({
  text: z.string(),
  expression: z.string(),
  personGender: z.string(),
  personAgeBand: z.string(),
  personBuild: z.string(),
});

const BodySchema = z.object({
  genderMatch: z.boolean(),
  ageBandMatch: z.boolean(),
  buildMatch: z.boolean(),
  faceShapeMatch: z.boolean(),
  stillTemplatePerson: z.boolean(),
  reasons: z.string(),
});

// Generic prompt text. The tuned wording is not part of this copy.
const kitPrompt = (n: number) => `You see ${n} photos of one person. Describe them so an image model can redraw them.
Return JSON: text (one paragraph about how the person looks), gender ("male" | "female" | "other"), ageBand ("0-12" | "13-17" |
"18-29" | "30-44" | "45-59" | "60+"), build ("slim" | "average" | "athletic" | "heavy"), hasVisibleBody (true if the photos show
the body, not only the face), nationality (string), bestRefIndexes (photo indexes from 0, best first).`;

const SCENE_PROMPT = `This is a template photo. Describe the main person and the scene.
Return JSON: text (pose, action, objects, clothing, camera, light, background), expression (the mood in 1 to 3 words),
personGender, personAgeBand ("0-12" | "13-17" | "18-29" | "30-44" | "45-59" | "60+"), personBuild ("slim" | "average" | "athletic" | "heavy").`;

const BODY_PROMPT = `Image 1 is a generated result. Images 2 to N-1 are the real person. The last image is the template.
Return JSON: genderMatch, ageBandMatch, buildMatch, faceShapeMatch (each true if Image 1 matches the real person),
stillTemplatePerson (true if Image 1 still looks like the template person), reasons (one short sentence).`;

const part = (buf: Buffer) => ({ inlineData: { mimeType: 'image/jpeg', data: buf.toString('base64') } });

/** Busy (503), rate limited (429), or timed out (408, 504): the next model in the list may answer. */
const busy = (err: unknown) => [408, 429, 503, 504].includes((err as { status?: number } | null)?.status ?? 0);

export function createGemini(opts: {
  client: Client;
  model: string;
  /** Tried in order when a model is busy or rate limited. */
  fallbackModels?: string[];
  mode: CacheMode;
  cacheDir: string;
}): VisionProvider {
  const models = [...new Set([opts.model, ...(opts.fallbackModels ?? [])])];
  async function ask<S extends z.ZodTypeAny>(op: string, prompt: string, images: Buffer[], schema: S): Promise<z.infer<S>> {
    return cached(
      // The cache key names the first model even when a fallback answered, so a replay finds the answer.
      { mode: opts.mode, dir: opts.cacheDir, provider: `gemini-${op}`, payload: { model: opts.model, prompt }, images },
      async () => {
        let res: { text?: string } | undefined;
        for (const model of models) {
          try {
            res = await opts.client.models.generateContent({
              model,
              contents: [{ role: 'user', parts: [{ text: prompt }, ...images.map(part)] }],
              config: { temperature: 0, responseMimeType: 'application/json', responseJsonSchema: z.toJSONSchema(schema) },
            });
            break;
          } catch (err) {
            if (!busy(err)) throw err;
          }
        }
        if (!res) throw new FatalError('PROVIDER_ERROR', `gemini ${op}: every model was busy (${models.join(', ')})`);
        let parsed: unknown;
        try {
          parsed = JSON.parse(res.text ?? '');
        } catch {
          throw new FatalError('PROVIDER_ERROR', `gemini ${op} returned non-JSON`);
        }
        const out = schema.safeParse(parsed);
        if (!out.success) throw new FatalError('PROVIDER_ERROR', `gemini ${op} JSON failed schema`);
        return out.data;
      },
    );
  }

  return {
    async buildKit(refs, refPaths) {
      const kit = await ask('kit', kitPrompt(refs.length), refs, KitSchema);
      const indexes = [...new Set(kit.bestRefIndexes)].filter((i) => i < refPaths.length).slice(0, REFS_MAX);
      return {
        text: kit.text,
        gender: kit.gender,
        ageBand: kit.ageBand,
        build: kit.build,
        hasVisibleBody: kit.hasVisibleBody ?? false,
        nationality: kit.nationality,
        refPaths: (indexes.length ? indexes : [0]).map((i) => refPaths[i]),
      };
    },
    readScene: (template) => ask('scene', SCENE_PROMPT, [template], SceneSchema),
    bodyCheck: (result, refs, template) => ask('body', BODY_PROMPT, [result, ...refs, template], BodySchema),
  };
}
