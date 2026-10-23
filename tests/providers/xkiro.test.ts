import { describe, expect, it } from 'vitest';
import { createXkiroClient, type XkiroFetch } from '@/src/providers/xkiro';

type Sent = { url: string; headers: Record<string, string>; body: Record<string, unknown> };

function fakeFetch(res: { status: number; body: unknown }) {
  const sent: Sent[] = [];
  const fetch: XkiroFetch = async (url, init) => {
    sent.push({ url, headers: init.headers, body: JSON.parse(init.body) });
    return { status: res.status, json: async () => res.body };
  };
  return { fetch, sent };
}

const req = {
  model: 'qwen/qwen3-vl-plus:free',
  contents: [{ role: 'user', parts: [{ text: 'describe' }, { inlineData: { mimeType: 'image/jpeg', data: 'AAAA' } }] }],
  config: { temperature: 0, responseMimeType: 'application/json', responseJsonSchema: { type: 'object', properties: { a: { type: 'string' } } } },
};

describe('xkiro client (Gemini-shaped adapter over OpenAI chat completions)', () => {
  it('sends text and images as one user message, JSON mode, temperature, and the schema in the prompt', async () => {
    const f = fakeFetch({ status: 200, body: { choices: [{ message: { content: '{"a":"x"}' } }] } });
    const out = await createXkiroClient({ apiKey: 'k', fetch: f.fetch }).models.generateContent(req);
    expect(out.text).toBe('{"a":"x"}');
    expect(f.sent[0].url).toBe('https://api.xkiro.com/v1/chat/completions');
    expect(f.sent[0].headers.Authorization).toBe('Bearer k');
    const body = f.sent[0].body as { model: string; temperature: number; response_format: unknown; messages: { content: unknown[] }[] };
    expect(body.model).toBe('qwen/qwen3-vl-plus:free');
    expect(body.temperature).toBe(0);
    expect(body.response_format).toEqual({ type: 'json_object' });
    const [text, image] = body.messages[0].content as [{ type: string; text: string }, { type: string; image_url: { url: string } }];
    // Qwen's JSON mode is only a prompt hint on xKiro, so the schema rides in the text; the caller still validates.
    expect(text.text).toContain('describe');
    expect(text.text).toContain('"properties"');
    expect(image).toEqual({ type: 'image_url', image_url: { url: 'data:image/jpeg;base64,AAAA' } });
  });

  it('strips a ```json fence around the answer', async () => {
    const f = fakeFetch({ status: 200, body: { choices: [{ message: { content: '```json\n{"a":"x"}\n```' } }] } });
    const out = await createXkiroClient({ apiKey: 'k', fetch: f.fetch }).models.generateContent(req);
    expect(out.text).toBe('{"a":"x"}');
  });

  it('throws with the HTTP status, so 429 and 503 move on to the next model', async () => {
    const f = fakeFetch({ status: 429, body: { error: { message: 'Rate limit exceeded' } } });
    const err = await createXkiroClient({ apiKey: 'k', fetch: f.fetch }).models.generateContent(req).catch((e) => e);
    expect((err as { status: number }).status).toBe(429);
    expect((err as Error).message).toContain('Rate limit exceeded');
  });
});
