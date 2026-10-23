import type { CostLedger } from '../pipeline/deps';
import type { StepCost } from '../types';

export type MemoryLedger = CostLedger & { all(): Promise<StepCost[]> };

export function createMemoryLedger(startUsd = 0): MemoryLedger {
  const rows: StepCost[] = [];
  const find = (jobId: string, step: string, attempt: number) =>
    rows.find((r) => r.jobId === jobId && r.step === step && r.attempt === attempt);
  const sum = () => startUsd + rows.reduce((s, r) => s + r.usd, 0);
  return {
    // No await between the check and the push: parallel reservations cannot both pass the cap.
    async reserve(r, capUsd) {
      if (find(r.jobId, r.step, r.attempt)) return 'exists';
      if (sum() + r.estimateUsd > capUsd) return 'over_cap';
      rows.push({ jobId: r.jobId, step: r.step, attempt: r.attempt, provider: r.provider, usd: r.estimateUsd, ms: 0 });
      return 'reserved';
    },
    async settle(jobId, step, attempt, usd, ms) {
      const row = find(jobId, step, attempt);
      if (row) Object.assign(row, { usd, ms });
    },
    total: async () => sum(),
    all: async () => [...rows],
  };
}
