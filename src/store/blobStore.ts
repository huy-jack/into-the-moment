import * as blob from '@vercel/blob';
import type { ImageStore } from '../pipeline/deps';

type Sdk = Pick<typeof blob, 'put' | 'head' | 'get' | 'issueSignedToken' | 'presignUrl'>;

export type BlobStore = ImageStore & { signedUrl(path: string, ttlS: number, now?: number): Promise<string> };

/** ImageStore on private Vercel Blob. Paths are exact (no random suffix) so steps can skip finished work. */
export function createBlobStore(token: string, sdk: Sdk = blob): BlobStore {
  return {
    async put(path, buf) {
      await sdk.put(path, buf, {
        access: 'private',
        token,
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: path.endsWith('.png') ? 'image/png' : 'image/jpeg',
      });
    },
    async get(path) {
      const res = await sdk.get(path, { access: 'private', token });
      if (!res || res.statusCode !== 200 || !res.stream) throw new Error(`blob not found: ${path}`);
      return Buffer.from(await new Response(res.stream).arrayBuffer());
    },
    async exists(path) {
      try {
        await sdk.head(path, { token });
        return true;
      } catch (err) {
        // The SDK leaves name as 'Error', so match the class.
        if (err instanceof blob.BlobNotFoundError) return false;
        throw err;
      }
    },
    async signedUrl(path, ttlS, now = Date.now()) {
      const validUntil = now + ttlS * 1000;
      const signed = await sdk.issueSignedToken({ token, pathname: path, operations: ['get'], validUntil });
      const { presignedUrl } = await sdk.presignUrl(signed, { operation: 'get', pathname: path, validUntil, access: 'private' });
      return presignedUrl;
    },
  };
}
