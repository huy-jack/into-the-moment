import { start } from 'workflow/api';
import { getDb } from '../db/client';
import { createRepo } from '../db/repo';
import { createDbLedger } from '../ledger/dbLedger';
import { createBlobStore } from '../store/blobStore';
import { swapWorkflow } from '../workflow/swap';
import { spendCapUsd } from './serverDeps';

/** What the API routes need. Tests replace this module. */
export function runtime() {
  const db = getDb();
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) throw new Error('missing env BLOB_READ_WRITE_TOKEN');
  return {
    repo: createRepo(db),
    ledger: createDbLedger(db),
    store: createBlobStore(token),
    start: async (jobId: string) => {
      await start(swapWorkflow, [jobId]);
    },
    now: () => new Date(),
    spendCapUsd: spendCapUsd(),
  };
}
