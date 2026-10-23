import { randomUUID } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { USER_PHOTOS_MAX, USER_PHOTOS_MIN } from '@/src/config';
import { checkCaps } from '@/src/db/repo';
import { errorResponse } from '@/src/server/http';
import { runtime } from '@/src/server/runtime';
import { DEFAULT_OPTIONS } from '@/src/types';

const Body = z.object({
  templatePath: z.string().startsWith('uploads/'),
  userPaths: z.array(z.string().startsWith('uploads/')).min(USER_PHOTOS_MIN).max(USER_PHOTOS_MAX),
  quality: z.enum(['high', 'medium']).optional(),
});

export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return errorResponse(400, 'BAD_UPLOAD', 'Send 1 template photo and 1 to 4 photos of you.');
  const rt = runtime();
  const { templatePath, userPaths, quality } = parsed.data;

  for (const p of [templatePath, ...userPaths]) {
    if (!(await rt.store.exists(p))) return errorResponse(400, 'BAD_UPLOAD', 'A photo did not finish uploading. Upload it again.');
  }
  const caps = await checkCaps(rt.repo, rt.ledger, rt.now(), rt.spendCapUsd);
  if (!caps.ok) return errorResponse(429, caps.code);

  const jobId = randomUUID();
  await rt.repo.createJob({ jobId, templatePath, userPaths, options: { ...DEFAULT_OPTIONS, ...(quality ? { quality } : {}) } });
  await rt.start(jobId);
  return NextResponse.json({ jobId }, { status: 202 });
}
