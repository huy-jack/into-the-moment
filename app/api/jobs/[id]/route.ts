import { NextResponse, type NextRequest } from 'next/server';
import { toApiJob } from '@/src/server/jobView';
import { runtime } from '@/src/server/runtime';

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const rt = runtime();
  const now = rt.now();
  // Stuck-job check rides on status reads: no timed job needed.
  await rt.repo.markStuck(now);
  const job = await rt.repo.getJob(id);
  if (!job) return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'This photo job does not exist.' } }, { status: 404 });
  return NextResponse.json(await toApiJob(job, rt.store, now));
}
