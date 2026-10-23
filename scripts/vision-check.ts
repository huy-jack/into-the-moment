// pnpm vision-check TEMPLATE PHOTO [PHOTO...]: one live kit and one scene read through the vision provider. Free tier.
import { readFile } from 'node:fs/promises';
import { createProviders } from '../src/providers';

async function main() {
  const [template, ...photos] = process.argv.slice(2);
  if (!template || photos.length === 0) throw new Error('usage: pnpm vision-check TEMPLATE PHOTO [PHOTO...]');
  const { vision } = createProviders({ mode: 'live', cacheDir: '' });
  const refs = await Promise.all(photos.map((p) => readFile(p)));
  const t0 = Date.now();
  console.log('kit:', JSON.stringify(await vision.buildKit(refs, photos), null, 2), `${Date.now() - t0} ms`);
  const t1 = Date.now();
  console.log('scene:', JSON.stringify(await vision.readScene(await readFile(template)), null, 2), `${Date.now() - t1} ms`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
