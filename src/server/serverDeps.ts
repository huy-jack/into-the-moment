import { FACE_T_DEFAULT, SPEND_CAP_USD_DEFAULT } from '../config';
import { getDb } from '../db/client';
import { createDbLedger } from '../ledger/dbLedger';
import type { Deps } from '../pipeline/deps';
import { createProviders } from '../providers';
import { createBlobStore } from '../store/blobStore';

export const spendCapUsd = () => Number(process.env.SPEND_CAP_USD ?? SPEND_CAP_USD_DEFAULT);
export const faceT = () => Number(process.env.FACE_T ?? FACE_T_DEFAULT);

/** Live providers, private Blob and the Neon ledger, built inside each workflow step. */
export function serverDeps(): Deps {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) throw new Error('missing env BLOB_READ_WRITE_TOKEN');
  return {
    ...createProviders({ mode: 'live', cacheDir: '' }),
    store: createBlobStore(token),
    ledger: createDbLedger(getDb()),
    spendCapUsd: spendCapUsd(),
    faceT: faceT(),
    log: (m) => console.log(m),
  };
}
