import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { ImageStore } from '../pipeline/deps';

export function createLocalStore(root: string): ImageStore {
  const full = (p: string) => path.join(root, p);
  return {
    async put(p, buf) {
      await mkdir(path.dirname(full(p)), { recursive: true });
      await writeFile(full(p), buf);
    },
    get: (p) => readFile(full(p)),
    exists: (p) =>
      access(full(p)).then(
        () => true,
        () => false,
      ),
  };
}
