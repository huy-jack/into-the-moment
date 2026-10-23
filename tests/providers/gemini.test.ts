import { describe, expect, it } from 'vitest';
import { FatalError } from '@/src/errors';
import { createGemini } from '@/src/providers/gemini';

function fakeClient(text: string) {
  const calls: { model: string; contents: unknown }[] = [];
  return {
    calls,
    client: {
      models: {
        generateContent: async (req: { model: string; contents: unknown }) => {
          calls.push(req);
          return { text };
        },
      },
    },
  };
}

const img = Buffer.from('x');
const make = (text: string) => {
  const f = fakeClient(text);
  return { ...f, vision: createGemini({ client: f.client as never, model: 'gemini-test', mode: 'live', cacheDir: '' }) };
};

describe('gemini provider', () => {
  it('kit maps best ref indexes to paths and caps at 4', async () => {
    const { vision } = make(
      JSON.stringify({ text: 'woman, 30s', gender: 'female', ageBand: '30-39', build: 'slim', bestRefIndexes: [4, 0, 2, 1, 3] }),
    );
    const kit = await vision.buildKit([img, img, img, img, img], ['p0', 'p1', 'p2', 'p3', 'p4']);
    expect(kit.refPaths).toEqual(['p4', 'p0', 'p2', 'p1']);
    expect(kit.gender).toBe('female');
  });

  it('kit prompt asks for the JSON fields', async () => {
    const { vision, calls } = make(
      JSON.stringify({ text: 'man', gender: 'male', ageBand: '18-29', build: 'average', bestRefIndexes: [0] }),
    );
    await vision.buildKit([img], ['p0']);
    const prompt = JSON.stringify(calls[0].contents);
    for (const field of ['gender', 'ageBand', 'build', 'hasVisibleBody', 'bestRefIndexes']) expect(prompt).toContain(field);
  });

  it('kit text is the paragraph only, asked at temperature 0', async () => {
    const { vision, calls } = make(
      JSON.stringify({ text: 'short black hair', gender: 'male', ageBand: '18-29', build: 'average', bestRefIndexes: [0] }),
    );
    const kit = await vision.buildKit([img], ['p0']);
    expect(kit.text).toBe('short black hair');
    expect((calls[0] as unknown as { config: { temperature: number } }).config.temperature).toBe(0);
  });

  it('scene asks for the mood of the expression, not the face muscles', async () => {
    const { vision, calls } = make(
      JSON.stringify({ text: 't', expression: 'focused', personGender: 'male', personAgeBand: '18-29', personBuild: 'athletic' }),
    );
    await vision.readScene(img);
    expect(JSON.stringify(calls[0].contents)).toContain('the mood in 1 to 3 words');
  });

  it('a busy or rate-limited model moves on to the next model in the list', async () => {
    const calls: string[] = [];
    let first = true;
    const client = {
      models: {
        generateContent: async (req: { model: string }) => {
          calls.push(req.model);
          if (first) {
            first = false;
            throw Object.assign(new Error('RESOURCE_EXHAUSTED'), { status: 429 });
          }
          return { text: JSON.stringify({ text: 't', expression: 'calm', personGender: 'male', personAgeBand: '18-29', personBuild: 'slim' }) };
        },
      },
    };
    const vision = createGemini({ client: client as never, model: 'gemini-a', fallbackModels: ['gemini-b'], mode: 'live', cacheDir: '' });
    expect((await vision.readScene(img)).expression).toBe('calm');
    expect(calls).toEqual(['gemini-a', 'gemini-b']);
  });

  it('an error that is not 429 or 503 does not move on', async () => {
    const calls: string[] = [];
    const client = {
      models: {
        generateContent: async (req: { model: string }) => {
          calls.push(req.model);
          throw Object.assign(new Error('bad request'), { status: 400 });
        },
      },
    };
    const vision = createGemini({ client: client as never, model: 'gemini-a', fallbackModels: ['gemini-b'], mode: 'live', cacheDir: '' });
    await expect(vision.readScene(img)).rejects.toThrow();
    expect(calls).toEqual(['gemini-a']);
  });

  it('when every model is busy the call fails as PROVIDER_ERROR', async () => {
    const client = {
      models: { generateContent: async () => Promise.reject(Object.assign(new Error('UNAVAILABLE'), { status: 503 })) },
    };
    const vision = createGemini({ client: client as never, model: 'gemini-a', fallbackModels: ['gemini-b'], mode: 'live', cacheDir: '' });
    const err = await vision.readScene(img).catch((e) => e);
    expect(err).toBeInstanceOf(FatalError);
    expect(err.code).toBe('PROVIDER_ERROR');
  });

  it('scene returns expression and template person fields', async () => {
    const { vision, calls } = make(
      JSON.stringify({
        text: 'man jumps off a pier',
        expression: 'laughing',
        personGender: 'male',
        personAgeBand: '20-29',
        personBuild: 'athletic',
      }),
    );
    const scene = await vision.readScene(img);
    expect(scene).toMatchObject({ expression: 'laughing', personGender: 'male', personAgeBand: '20-29' });
    expect(calls[0].model).toBe('gemini-test');
  });

  it('bodyCheck parses the five booleans, face shape included', async () => {
    const answer = { genderMatch: true, ageBandMatch: false, buildMatch: true, faceShapeMatch: false, stillTemplatePerson: false, reasons: 'face slimmer' };
    const { vision, calls } = make(JSON.stringify(answer));
    const check = await vision.bodyCheck(img, [img], img);
    expect(check).toEqual(answer);
    expect(JSON.stringify(calls[0].contents)).toContain('faceShapeMatch');
  });

  it('invalid JSON throws FatalError PROVIDER_ERROR', async () => {
    const { vision } = make('not json');
    const err = await vision.readScene(img).catch((e) => e);
    expect(err).toBeInstanceOf(FatalError);
    expect(err.code).toBe('PROVIDER_ERROR');
  });
});
