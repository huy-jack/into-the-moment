/**
 * xKiro (api.xkiro.com) speaks OpenAI Chat Completions. This adapter gives it the shape of the Gemini client's
 * generateContent, so the vision provider keeps its prompts, schemas and answer checks unchanged.
 */

export type XkiroFetch = (
  url: string,
  init: { method: string; headers: Record<string, string>; body: string },
) => Promise<{ status: number; json(): Promise<unknown> }>;

type Part = { text?: string; inlineData?: { mimeType: string; data: string } };
type Request = {
  model: string;
  contents: { role: string; parts: Part[] }[];
  config?: { temperature?: number; responseMimeType?: string; responseJsonSchema?: unknown };
};

const URL = 'https://api.xkiro.com/v1/chat/completions';

/** Qwen answers sometimes come wrapped in a ```json fence. */
const unfence = (s: string) => s.replace(/^\s*```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '');

export function createXkiroClient(opts: { apiKey: string; fetch?: XkiroFetch; timeoutMs?: number }) {
  const doFetch: XkiroFetch = opts.fetch ?? ((url, init) => fetch(url, init));
  const timeoutMs = opts.timeoutMs ?? 25000;
  return {
    models: {
      async generateContent(req: Request): Promise<{ text: string }> {
        const parts = req.contents.flatMap((c) => c.parts);
        const schema = req.config?.responseJsonSchema;
        // xKiro applies Qwen's JSON mode as a prompt hint only, so the schema goes into the text as well.
        const text = parts.flatMap((p) => (p.text ? [p.text] : [])).join('\n') + (schema ? `\nAnswer with JSON only, matching this JSON schema: ${JSON.stringify(schema)}` : '');
        const images = parts.flatMap((p) => (p.inlineData ? [{ type: 'image_url', image_url: { url: `data:${p.inlineData.mimeType};base64,${p.inlineData.data}` } }] : []));
        let res: { status: number; json(): Promise<unknown> };
        try {
          const controller = typeof AbortSignal !== 'undefined' && 'timeout' in AbortSignal ? AbortSignal.timeout(timeoutMs) : undefined;
          res = await doFetch(URL, {
            method: 'POST',
            headers: { Authorization: `Bearer ${opts.apiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: req.model,
              messages: [{ role: 'user', content: [{ type: 'text', text }, ...images] }],
              temperature: req.config?.temperature,
              ...(req.config?.responseMimeType === 'application/json' ? { response_format: { type: 'json_object' } } : {}),
            }),
            ...(controller ? { signal: controller } : {}),
          });
        } catch (fetchErr) {
          // A network error or timeout throws with status 504 so the vision provider moves to the next fallback model.
          throw Object.assign(new Error(`xkiro network/timeout error: ${(fetchErr as Error)?.message ?? 'timeout'}`), { status: 504 });
        }
        const body = (await res.json().catch(() => null)) as { choices?: { message?: { content?: string } }[]; error?: { message?: string } } | null;
        if (res.status !== 200) {
          // The status rides on the error so the vision provider moves on to the next model on 429 or 503.
          throw Object.assign(new Error(`xkiro ${res.status}: ${body?.error?.message ?? 'no detail'}`), { status: res.status });
        }
        return { text: unfence(body?.choices?.[0]?.message?.content ?? '') };
      },
    },
  };
}
