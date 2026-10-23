import { createHash } from 'node:crypto';

function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object' && !Buffer.isBuffer(value)) {
    return Object.fromEntries(
      Object.keys(value as Record<string, unknown>)
        .sort()
        .map((k) => [k, stable((value as Record<string, unknown>)[k])]),
    );
  }
  return value;
}

const sha = (data: string | Buffer) => createHash('sha256').update(data).digest('hex');

/** Stable key for a provider request: payload key order does not matter, image bytes do. */
export function hashRequest(provider: string, payload: unknown, images: Buffer[]): string {
  return sha(JSON.stringify({ provider, payload: stable(payload), images: images.map((b) => sha(b)) }));
}
