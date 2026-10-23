import type { Candidate, Quality, Route, StepCost } from '../../src/types';

export type PairResult = {
  id: string;
  case: string;
  templatePath: string;
  userPaths: string[];
  route: Route | null;
  error: string | null;
  ms: number;
  candidates: Candidate[];
  costs: StepCost[];
};

export type HarnessRun = {
  startedAt: string;
  mode: string;
  settings: { quality: Quality };
  pairs: PairResult[];
};

const usd = (n: number) => `$${n.toFixed(3)}`;
const sec = (ms: number) => `${(ms / 1000).toFixed(1)} s`;
const img = (p: string) => `<img src="${p}" width="220">`;

function body(c: Candidate): string {
  const b = c.bodyCheck;
  if (!b) return 'n/a';
  const pass = b.genderMatch && b.ageBandMatch && b.buildMatch && !b.stillTemplatePerson;
  const fails = [
    !b.genderMatch && 'gender',
    !b.ageBandMatch && 'age',
    !b.buildMatch && 'build',
    b.stillTemplatePerson && 'still template person',
  ].filter(Boolean);
  return pass ? 'pass' : `fail (${fails.join(', ')})${b.reasons ? `: ${b.reasons}` : ''}`;
}

function status(c: Candidate): string {
  if (c.refused) return `refused: ${c.refusalText ?? ''}`;
  if (c.failed) return 'failed';
  return 'ok';
}

/** Markdown report: one section per pair, every version side by side, measured cost and time. */
export function renderReport(run: HarnessRun): string {
  const all = run.pairs.flatMap((p) => p.costs);
  const total = all.reduce((s, c) => s + c.usd, 0);
  const out: string[] = [
    `# B1 harness report`,
    '',
    `Started ${run.startedAt} · mode ${run.mode} · quality ${run.settings.quality}`,
    '',
    `**Total cost:** ${usd(total)} · **Pairs:** ${run.pairs.length}`,
    '',
  ];

  for (const p of run.pairs) {
    const pairUsd = p.costs.reduce((s, c) => s + c.usd, 0);
    out.push(`## ${p.id} (case ${p.case})`, '');
    out.push(`Route: ${p.route ?? 'n/a'} · time ${sec(p.ms)} · cost ${usd(pairUsd)}${p.error ? ` · **error: ${p.error}**` : ''}`, '');
    out.push(`Template and user photos:`, '', [p.templatePath, ...p.userPaths].map(img).join(' '), '');
    out.push('| Rank | Version | Model | Status | Face score | Body check | Image |', '|---|---|---|---|---|---|---|');
    p.candidates.forEach((c, i) => {
      out.push(
        `| ${i + 1} | ${c.slot}-${c.attempt} | ${c.model} | ${status(c)} | ${c.score === null ? 'n/a' : c.score.toFixed(1)} | ${body(c)} | ${c.path ? img(c.path) : ''} |`,
      );
    });
    out.push('', '| Step | Attempt | Provider | Cost | Time |', '|---|---|---|---|---|');
    for (const c of p.costs) out.push(`| ${c.step} | ${c.attempt} | ${c.provider} | ${usd(c.usd)} | ${sec(c.ms)} |`);
    out.push('', '**Eye check:** _write your judgment here: is it the user? is the action kept?_', '');
  }
  return out.join('\n');
}
