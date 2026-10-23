// Threshold calibration: CompareFaces on same-person and different-person stock pairs. No generation.
// pnpm calibrate --people fixtures/people.json [--mode record|replay]
import { readFile, writeFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { workingCopy } from '../src/lib/image';
import type { CacheMode } from '../src/providers/cache';
import { REKOGNITION_USD } from '../src/providers/prices';
import { createRekognition, createRekognitionClient } from '../src/providers/rekognition';
import { suggestThreshold } from './lib/calibrate';

type Person = { name: string; photos: string[] };

const { values } = parseArgs({
  options: {
    people: { type: 'string', default: 'fixtures/people.json' },
    mode: { type: 'string', default: 'record' },
    cache: { type: 'string', default: 'fixtures/cache' },
    out: { type: 'string', default: 'fixtures/calibration.json' },
  },
});

async function main() {
  const people = JSON.parse(await readFile(values.people!, 'utf8')) as Person[];
  const faces = createRekognition({
    client: createRekognitionClient(process.env.AWS_REGION ?? 'us-east-1'),
    mode: values.mode as CacheMode,
    cacheDir: values.cache!,
  });
  const load = async (p: string) => (await workingCopy(await readFile(p))).buf;
  const photos = await Promise.all(people.map(async (x) => ({ name: x.name, bufs: await Promise.all(x.photos.map(load)) })));

  let calls = 0;
  const score = async (a: Buffer, b: Buffer) => {
    calls++;
    return (await faces.compare(a, b)) ?? 0;
  };

  const same: number[] = [];
  for (const p of photos) {
    for (let i = 0; i < p.bufs.length; i++) for (let j = i + 1; j < p.bufs.length; j++) same.push(await score(p.bufs[i], p.bufs[j]));
  }
  // Different people: the first 2 photos of each person against the first 2 of every other person.
  const diff: number[] = [];
  for (let i = 0; i < photos.length; i++) {
    for (let j = i + 1; j < photos.length; j++) {
      for (const a of photos[i].bufs.slice(0, 2)) for (const b of photos[j].bufs.slice(0, 2)) diff.push(await score(a, b));
    }
  }
  if (!same.length || !diff.length) throw new Error('need at least 2 people with 2 photos each');

  const result = { ...suggestThreshold(same, diff), same, diff, calls, usd: calls * REKOGNITION_USD };
  await writeFile(values.out!, JSON.stringify(result, null, 2));
  console.log(
    `same-person min ${result.minSame.toFixed(1)} · different-person max ${result.maxDiff.toFixed(1)} · ` +
      `${result.overlap ? 'OVERLAP' : 'no overlap'} · suggested FACE_T=${result.t.toFixed(1)} · ${calls} calls ≈ $${result.usd.toFixed(3)}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
