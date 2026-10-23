import { upload } from '@vercel/blob/client';
import type { ErrorCode } from '../errors';
import type { Route } from '../types';
import type { ApiCandidate } from './flow';

// Browser calls to the app's own API. Every error comes back as { error: { code, message } }
// with a message already written for the user.

export class ApiError extends Error {
  constructor(public readonly code: ErrorCode | 'NOT_FOUND' | 'NETWORK', message: string, public readonly status: number) {
    super(message);
    this.name = 'ApiError';
  }
}

export type ApiJob = {
  id: string;
  status: 'queued' | 'running' | 'done' | 'failed';
  stage: string;
  route: Route | null;
  error: { code: ErrorCode; message: string } | null;
  parentJobId: string | null;
  inputs: { template: string; users: string[] } | null;
  candidates: ApiCandidate[];
  pollAfterMs?: number;
  createdAt: string;
  updatedAt: string;
};

export type Problem = 'face' | 'body' | 'scene';

async function call<T>(path: string, init?: { method: string; body: unknown }): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, init ? { method: init.method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(init.body) } : undefined);
  } catch {
    throw new ApiError('NETWORK', 'No connection. Check your internet and try again.', 0);
  }
  const body = (await res.json().catch(() => null)) as (T & { error?: { code: ErrorCode; message: string } }) | null;
  if (!res.ok || !body) {
    const e = body?.error;
    throw new ApiError(e?.code ?? 'PROVIDER_ERROR', e?.message ?? 'Something went wrong. Try again.', res.status);
  }
  return body;
}

export const hasAccess = () => call<{ ok: boolean }>('/api/access').then((r) => r.ok);

export const enterCode =(code: string) => call<{ ok: true }>('/api/access', { method: 'POST', body: { code } });

export const logOut = () => call<{ ok: true }>('/api/access', { method: 'DELETE', body: null });

export const createJob = (templatePath: string, userPaths: string[]) =>
  call<{ jobId: string }>('/api/jobs', { method: 'POST', body: { templatePath, userPaths } });

export const getJob = (id: string) => call<ApiJob>(`/api/jobs/${encodeURIComponent(id)}`);

export const rerunJob = (id: string, problem: Problem) =>
  call<{ jobId: string }>(`/api/jobs/${encodeURIComponent(id)}/rerun`, { method: 'POST', body: { problem } });

/** Straight from the browser to private Blob storage; the server only signs the upload. Returns the stored path. */
export async function uploadPhoto(file: File, onProgress?: (pct: number) => void): Promise<string> {
  const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
  try {
    const res = await upload(`uploads/${crypto.randomUUID()}.${ext}`, file, {
      access: 'private',
      handleUploadUrl: '/api/upload',
      contentType: file.type,
      onUploadProgress: onProgress ? (p) => onProgress(p.percentage) : undefined,
    });
    return res.pathname;
  } catch (err) {
    const msg = (err as Error).message ?? '';
    if (/401|access code/i.test(msg)) throw new ApiError('BAD_CODE', 'Enter the access code first.', 401);
    throw new ApiError('BAD_UPLOAD', 'This photo did not upload. Check your connection and try again.', 400);
  }
}
