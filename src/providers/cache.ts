import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { RefusalError } from '../errors';
import { hashRequest } from '../lib/hash';

export type CacheMode = 'live' | 'record' | 'replay';

export type CacheOpts = { mode: CacheMode; dir: string; provider: string; payload: unknown; images: Buffer[] };

type Entry = { kind: 'ok'; value: unknown } | { kind: 'refusal'; text: string };

/** Replace Buffers with {$bin: file} markers; writes each Buffer as a sibling .bin file. */
async function pack(value: unknown, base: string, files: { n: number }): Promise<unknown> {
  if (Buffer.isBuffer(value)) {
    const name = `${path.basename(base)}.${files.n++}.bin`;
    await writeFile(path.join(path.dirname(base), name), value);
    return { $bin: name };
  }
  if (Array.isArray(value)) return Promise.all(value.map((v) => pack(v, base, files)));
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = await pack(v, base, files);
    return out;
  }
  return value;
}

async function unpack(value: unknown, dir: string): Promise<unknown> {
  if (Array.isArray(value)) return Promise.all(value.map((v) => unpack(v, dir)));
  if (value && typeof value === 'object') {
    const rec = value as Record<string, unknown>;
    if (typeof rec.$bin === 'string' && Object.keys(rec).length === 1) return readFile(path.join(dir, rec.$bin));
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(rec)) out[k] = await unpack(v, dir);
    return out;
  }
  return value;
}

/**
 * Live: call only. Record: call and save the answer (refusals too). Replay: read the saved
 * answer and never call; a missing answer throws "replay miss".
 */
export async function cached<T>(opts: CacheOpts, call: () => Promise<T>): Promise<T> {
  if (opts.mode === 'live') return call();

  const hash = hashRequest(opts.provider, opts.payload, opts.images);
  const dir = path.join(opts.dir, opts.provider);
  const base = path.join(dir, hash);

  if (opts.mode === 'replay') {
    let raw: string;
    try {
      raw = await readFile(`${base}.json`, 'utf8');
    } catch {
      throw new Error(`replay miss: ${opts.provider} ${hash}`);
    }
    const entry = JSON.parse(raw) as Entry;
    if (entry.kind === 'refusal') throw new RefusalError(entry.text);
    return (await unpack(entry.value, dir)) as T;
  }

  await mkdir(dir, { recursive: true });
  let entry: Entry;
  try {
    const value = await call();
    entry = { kind: 'ok', value: await pack(value, base, { n: 0 }) };
    await writeFile(`${base}.json`, JSON.stringify(entry, null, 2));
    return value;
  } catch (err) {
    if (err instanceof RefusalError) {
      entry = { kind: 'refusal', text: err.text };
      await writeFile(`${base}.json`, JSON.stringify(entry, null, 2));
    }
    throw err;
  }
}
