import { BlobNotFoundError } from '@vercel/blob';
import { describe, expect, it } from 'vitest';
import { createBlobStore } from '@/src/store/blobStore';

function fakeSdk() {
  const files = new Map<string, Buffer>();
  const putCalls: { path: string; opts: Record<string, unknown> }[] = [];
  return {
    files,
    putCalls,
    sdk: {
      put: async (path: string, body: Buffer, opts: Record<string, unknown>) => {
        putCalls.push({ path, opts });
        files.set(path, body);
        return { pathname: path };
      },
      head: async (path: string) => {
        // The real SDK error: its name is plain 'Error', so only instanceof identifies it.
        if (!files.has(path)) throw new BlobNotFoundError();
        return { pathname: path };
      },
      get: async (path: string) =>
        files.has(path) ? { statusCode: 200, stream: new Blob([new Uint8Array(files.get(path)!)]).stream() } : null,
      issueSignedToken: async () => ({ clientSigningToken: 'c', delegationToken: 'd' }),
      presignUrl: async (_t: unknown, o: { pathname: string; validUntil?: number }) => ({
        presignedUrl: `https://blob/${o.pathname}?until=${o.validUntil}`,
      }),
    },
  };
}

describe('blob store', () => {
  it('put then exists is true, and get returns the bytes', async () => {
    const f = fakeSdk();
    const store = createBlobStore('token', f.sdk as never);
    expect(await store.exists('jobs/j1/a-1.png')).toBe(false);
    await store.put('jobs/j1/a-1.png', Buffer.from('img'));
    expect(await store.exists('jobs/j1/a-1.png')).toBe(true);
    expect((await store.get('jobs/j1/a-1.png')).toString()).toBe('img');
  });

  it('writes private blobs at the exact path', async () => {
    const f = fakeSdk();
    await createBlobStore('token', f.sdk as never).put('jobs/j1/a-1.png', Buffer.from('img'));
    expect(f.putCalls[0].opts).toMatchObject({ access: 'private', addRandomSuffix: false, allowOverwrite: true });
  });

  it('signs a link that expires after the given seconds', async () => {
    const f = fakeSdk();
    const url = await createBlobStore('token', f.sdk as never).signedUrl('jobs/j1/a-1.png', 3600, 1_000_000);
    expect(url).toBe(`https://blob/jobs/j1/a-1.png?until=${1_000_000 + 3_600_000}`);
  });
});
