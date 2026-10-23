import { SpendCapError } from '../errors';
import type { ImageProvider } from '../providers/images';
import type { VisionProvider } from '../providers/gemini';
import type { FaceProvider } from '../providers/rekognition';
import type { StepCost } from '../types';

export interface ImageStore {
  put(path: string, buf: Buffer): Promise<void>;
  get(path: string): Promise<Buffer>;
  exists(path: string): Promise<boolean>;
}

export type Reservation = { jobId: string; step: string; attempt: number; provider: string; estimateUsd: number };

/**
 * Every paid call reserves its estimated cost before it runs, checked against the cap in the
 * same write, then settles the real cost after. A call that fails keeps its estimate, so a
 * provider that bills a timed-out job still counts against the cap.
 */
export interface CostLedger {
  /** 'exists' means this step and attempt already reserved: a replay, already counted. */
  reserve(r: Reservation, capUsd: number): Promise<'reserved' | 'exists' | 'over_cap'>;
  settle(jobId: string, step: string, attempt: number, usd: number, ms: number): Promise<void>;
  total(): Promise<number>;
}

export type Deps = {
  faces: FaceProvider;
  vision: VisionProvider;
  images: ImageProvider;
  store: ImageStore;
  ledger: CostLedger;
  spendCapUsd: number;
  faceT: number;
  log: (msg: string) => void;
  /** Injected so tests do not wait on rate-limit delays. */
  sleep?: (ms: number) => Promise<void>;
};

export type PaidCost = Reservation;

/** Every paid call: reserve against the cap, call, settle the real cost. A replayed step is already reserved. */
export async function paid<T>(deps: Deps, cost: PaidCost, call: () => Promise<T>): Promise<T> {
  const r = await deps.ledger.reserve(cost, deps.spendCapUsd);
  if (r === 'over_cap') throw new SpendCapError(`${cost.step}: would pass the $${deps.spendCapUsd} cap`);
  const started = Date.now();
  const out = await call();
  const reported = (out as { usd?: unknown } | null)?.usd;
  await deps.ledger.settle(cost.jobId, cost.step, cost.attempt, typeof reported === 'number' ? reported : cost.estimateUsd, Date.now() - started);
  return out;
}
