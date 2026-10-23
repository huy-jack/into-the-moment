// End-to-end check against a deployed URL. Spends real credits: one job per run.
// pnpm smoke --url https://<deployment> --code <access code> --pair c1 [--pairs fixtures/pairs.json]
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { upload } from '@vercel/blob/client';
import { pollUntilDone } from './lib/poll';
import type { Pair } from './lib/runPairs';

const { values } = parseArgs({
  options: {
    url: { type: 'string' },
    code: { type: 'string' },
    pair: { type: 'string', default: 'c1' },
    pairs: { type: 'string', default: 'fixtures/pairs.json' },
  },
});

type ApiJob = {
  id: string;
  status: string;
  stage: string;
  route: string | null;
  error: { code: string; message: string } | null;
  pollAfterMs?: number;
  candidates: { slot: string; model: string; attempt: number; url: string | null; refused: boolean; refusalText: string | null; failed: boolean; score: number | null }[];
};

async function main() {
  const base = values.url?.replace(/\/$/, '');
  if (!base || !values.code) throw new Error('need --url and --code');
  const pair = (JSON.parse(await readFile(values.pairs!, 'utf8')) as Pair[]).find((p) => p.id === values.pair);
  if (!pair) throw new Error(`pair ${values.pair} not found`);
  const started = Date.now();

  const access = await fetch(`${base}/api/access`, { method: 'POST', body: JSON.stringify({ code: values.code }) });
  console.log(`access: ${access.status}`);
  if (!access.ok) {
    console.log(await access.text());
    process.exit(1);
  }
  const cookie = (access.headers.get('set-cookie') ?? '').split(';')[0];

  const put = async (file: string, name: string) => {
    const res = await upload(`uploads/smoke/${name}${path.extname(file)}`, await readFile(file), {
      access: 'private',
      handleUploadUrl: `${base}/api/upload`,
      headers: { cookie },
    });
    return res.pathname;
  };
  const templatePath = await put(pair.template, 'template');
  const userPaths = await Promise.all(pair.users.map((u, i) => put(u, `user-${i}`)));
  console.log(`uploaded ${1 + userPaths.length} photos`);

  const created = await fetch(`${base}/api/jobs`, {
    method: 'POST',
    headers: { cookie },
    body: JSON.stringify({ templatePath, userPaths }),
  });
  const createdBody = await created.json();
  console.log(`create: ${created.status} ${JSON.stringify(createdBody)}`);
  if (created.status !== 202) process.exit(1);

  const { job, stages } = await pollUntilDone<ApiJob>(
    async () => (await fetch(`${base}/api/jobs/${createdBody.jobId}`, { headers: { cookie } })).json(),
    (ms) => new Promise((r) => setTimeout(r, ms)),
    () => Date.now(),
    600_000,
  );

  const out = path.join('reports', `smoke-${new Date().toISOString().replace(/[:.]/g, '-')}`);
  await mkdir(out, { recursive: true });
  const lines = [
    `# Smoke ${pair.id} against ${base}`,
    '',
    `Status **${job.status}** · route ${job.route} · total ${((Date.now() - started) / 1000).toFixed(1)} s`,
    job.error ? `Error: ${job.error.code}: ${job.error.message}` : '',
    `Stages seen: ${stages.join(' → ')}`,
    '',
    '| Version | Model | Status | Score | File |',
    '|---|---|---|---|---|',
  ];
  for (const c of job.candidates) {
    let file = '';
    if (c.url) {
      file = `${c.slot}-${c.attempt}.png`;
      await writeFile(path.join(out, file), Buffer.from(await (await fetch(c.url)).arrayBuffer()));
    }
    const status = c.refused ? `refused: ${c.refusalText}` : c.failed ? 'failed' : 'ok';
    lines.push(`| ${c.slot}-${c.attempt} | ${c.model} | ${status} | ${c.score?.toFixed(1) ?? 'n/a'} | ${file ? `![](${file})` : ''} |`);
  }
  await writeFile(path.join(out, 'report.md'), lines.join('\n'));
  console.log(`${job.status} in ${((Date.now() - started) / 1000).toFixed(1)} s · ${job.candidates.length} versions · ${out}/report.md`);
  if (job.status !== 'done') process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
