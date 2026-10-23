// One job from the database: stages, every paid call with cost and time, and every version with its scores.
// pnpm job:report [jobId]   (no id: the newest job)
import { neon } from '@neondatabase/serverless';

const sql = neon((process.env.DATABASE_URL ?? '').trim());

async function main() {
  const id = process.argv[2];
  const [job] = id ? await sql`select * from jobs where id = ${id}` : await sql`select * from jobs order by created_at desc limit 1`;
  if (!job) throw new Error('no job found');
  const secs = (Date.parse(job.updated_at) - Date.parse(job.created_at)) / 1000;
  console.log(`JOB ${job.id}\n  status ${job.status} · route ${job.route ?? '-'} · ${secs.toFixed(0)} s · error ${job.error_code ?? '-'}`);

  const photos = await sql`select kind, width, height, age_low, age_high, face_size_ratio, quality_ok, quality_reason from photos where job_id = ${job.id} order by kind`;
  if (photos.length) {
    console.log('\nPHOTOS');
    for (const p of photos) {
      const face = p.face_size_ratio == null ? '' : ` · face ${(p.face_size_ratio * 100).toFixed(0)}% of height`;
      const age = p.age_low == null ? '' : ` · age ${p.age_low}-${p.age_high}`;
      console.log(`  ${p.kind.padEnd(8)} ${p.width}x${p.height}${face}${age}${p.quality_ok === false ? ` · REJECTED ${p.quality_reason}` : ''}`);
    }
  }

  const costs = await sql`select step, attempt, provider, usd, ms from step_costs where job_id = ${job.id} order by created_at`;
  console.log('\nPAID CALLS');
  for (const c of costs) console.log(`  ${c.step.padEnd(22)} ${c.provider.padEnd(24)} $${c.usd.toFixed(4)}  ${(c.ms / 1000).toFixed(1)} s`);
  const by = new Map<string, number>();
  for (const c of costs) by.set(c.provider, (by.get(c.provider) ?? 0) + c.usd);
  console.log(`  TOTAL $${costs.reduce((s, c) => s + c.usd, 0).toFixed(4)}  (${[...by].map(([p, u]) => `${p} $${u.toFixed(4)}`).join(', ')})`);

  const cands = await sql`select * from candidates where job_id = ${job.id} order by rank`;
  console.log('\nVERSIONS (best first)');
  for (const c of cands) {
    const b = c.body_check;
    const body = b
      ? `gender ${b.genderMatch ? 'ok' : 'NO'}, age ${b.ageBandMatch ? 'ok' : 'NO'}, build ${b.buildMatch ? 'ok' : 'NO'}, face shape ${b.faceShapeMatch ? 'ok' : 'NO'}, template person left ${b.stillTemplatePerson ? 'YES' : 'no'}`
      : 'none';
    const state = c.refused ? `REFUSED ${c.refusal_text ?? ''}` : c.failed ? 'FAILED' : 'image';
    console.log(`  #${c.rank} ${c.slot}-${c.attempt} ${c.model} · ${state} · Rekognition score ${c.identity_score?.toFixed(1) ?? '-'}\n      body check: ${body}`);
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
