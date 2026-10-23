import { randomUUID } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { checkCaps } from '@/src/db/repo';
import { optionsForProblem } from '@/src/pipeline/rank';
import { errorResponse } from '@/src/server/http';
import { runtime } from '@/src/server/runtime';

const Body = z.object({ problem: z.enum(['face', 'body', 'scene']) });

/** Quick fix: a new job from the same original photos, never an edit of the result. */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return errorResponse(400, 'BAD_UPLOAD', 'Choose what is wrong: face, body or scene.');
  const rt = runtime();
  const parent = await rt.repo.getJob(id);
  if (!parent) return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'This photo job does not exist.' } }, { status: 404 });

  const caps = await checkCaps(rt.repo, rt.ledger, rt.now(), rt.spendCapUsd);
  if (!caps.ok) return errorResponse(429, caps.code);

  const jobId = randomUUID();
  // "Face is wrong" can mean the kit's words were wrong, so that rerun describes the person again.
  const { kit, ...photos } = parent.input;
  await rt.repo.createJob(
    {
      jobId,
      ...photos,
      ...(kit && parsed.data.problem !== 'face' ? { kit } : {}),
      options: optionsForProblem(parsed.data.problem, parent.options),
    },
    parent.id,
    parsed.data.problem,
  );
  await rt.start(jobId);
  return NextResponse.json({ jobId }, { status: 202 });
}
