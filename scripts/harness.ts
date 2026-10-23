// B1 test script: runs the swap on fixed pairs and writes a measured report.
// pnpm harness --pairs fixtures/pairs.json --mode record|replay|live --max-spend 6 [--only id] [--quality high|medium]
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { FACE_T_DEFAULT, HARNESS_MAX_SPEND_USD } from '../src/config';
import { createMemoryLedger } from '../src/ledger/memoryLedger';
import type { CacheMode } from '../src/providers/cache';
import { createProviders } from '../src/providers';
import { createLocalStore } from '../src/store/localStore';
import type { Quality } from '../src/types';
import { renderReport, type HarnessRun } from './lib/report';
import { runPairs, type Pair } from './lib/runPairs';

const { values } = parseArgs({
  options: {
    pairs: { type: 'string', default: 'fixtures/pairs.json' },
    mode: { type: 'string', default: 'record' },
    'max-spend': { type: 'string', default: String(HARNESS_MAX_SPEND_USD) },
    only: { type: 'string', multiple: true },
    quality: { type: 'string', default: 'high' },
    cache: { type: 'string', default: 'fixtures/cache' },
  },
});

async function main() {
  const mode = values.mode as CacheMode;
  const quality = values.quality as Quality;
  const maxSpend = Number(values['max-spend']);
  const all = JSON.parse(await readFile(values.pairs!, 'utf8')) as Pair[];
  const selected = values.only?.length ? all.filter((p) => values.only!.includes(p.id)) : all;
  if (selected.length === 0) throw new Error('no pairs selected');

  const startedAt = new Date().toISOString();
  const root = path.join('reports', startedAt.replace(/[:.]/g, '-'));
  const store = createLocalStore(path.join(root, 'store'));

  // Copy each pair's photos into the run's store, so the report links to them.
  const pairs: Pair[] = [];
  for (const p of selected) {
    const template = `uploads/${p.id}/template${path.extname(p.template)}`;
    await store.put(template, await readFile(p.template));
    const users: string[] = [];
    for (const [i, u] of p.users.entries()) {
      users.push(`uploads/${p.id}/u${i}${path.extname(u)}`);
      await store.put(users[i], await readFile(u));
    }
    pairs.push({ ...p, template, users });
  }

  const ledger = createMemoryLedger();
  const deps = {
    ...createProviders({ mode, cacheDir: values.cache! }),
    store,
    ledger,
    spendCapUsd: maxSpend,
    faceT: Number(process.env.FACE_T ?? FACE_T_DEFAULT),
    log: (m: string) => console.log(`  ${m}`),
  };

  console.log(`harness: ${pairs.length} pairs, mode ${mode}, quality ${quality}, max $${maxSpend}`);
  const out = await runPairs(pairs, deps, { quality });

  const prefix = (p: string | null) => (p ? `store/${p}` : p);
  const run: HarnessRun = {
    startedAt,
    mode,
    settings: { quality },
    pairs: out.pairs.map((p) => ({
      ...p,
      templatePath: prefix(p.templatePath)!,
      userPaths: p.userPaths.map((u) => prefix(u)!),
      candidates: p.candidates.map((c) => ({ ...c, path: prefix(c.path) })),
    })),
  };
  await mkdir(root, { recursive: true });
  await writeFile(path.join(root, 'report.md'), renderReport(run));
  await writeFile(path.join(root, 'report.json'), JSON.stringify(run, null, 2));
  console.log(`total $${(await ledger.total()).toFixed(3)} · report ${path.join(root, 'report.md')}`);
  if (out.stoppedBySpend) {
    console.error(`stopped: the next call would pass $${maxSpend}`);
    process.exit(2);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
