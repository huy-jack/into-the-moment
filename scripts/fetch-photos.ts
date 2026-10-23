// pnpm photos: download the stock test photos listed in fixtures/photos/CREDITS.md.
// The photos are not committed (the Pexels license does not allow sharing unchanged copies as a
// collection), so every clone fetches them from the source links instead. Files that exist are kept.
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parseCredits, pexelsImageUrl } from './lib/credits';

const DIR = 'fixtures/photos';

async function main() {
  const rows = parseCredits(await readFile(path.join(DIR, 'CREDITS.md'), 'utf8'));
  let fetched = 0;
  for (const row of rows) {
    const out = path.join(DIR, row.path);
    if (await stat(out).then(() => true, () => false)) continue;
    const res = await fetch(pexelsImageUrl(row.pexelsId), { headers: { 'user-agent': 'Mozilla/5.0' } });
    if (!res.ok) throw new Error(`${row.path}: Pexels answered ${res.status}`);
    await mkdir(path.dirname(out), { recursive: true });
    await writeFile(out, Buffer.from(await res.arrayBuffer()));
    fetched++;
    console.log(`fetched ${row.path}`);
  }
  console.log(`photos: ${fetched} fetched, ${rows.length - fetched} already present`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
