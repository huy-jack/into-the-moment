import { and, eq, sql, sum } from 'drizzle-orm';
import type { Db } from '../db/repo';
import { stepCosts } from '../db/schema';
import type { CostLedger } from '../pipeline/deps';

const rowsOf = (r: unknown): unknown[] => (Array.isArray(r) ? r : ((r as { rows?: unknown[] }).rows ?? []));

export function createDbLedger(db: Db): CostLedger {
  return {
    async reserve(r, capUsd) {
      // Cap check and insert in one statement: the window between them shrinks to one statement.
      const inserted = rowsOf(
        await db.execute(sql`
          insert into step_costs (job_id, step, attempt, provider, usd, ms)
          select ${r.jobId}, ${r.step}, ${r.attempt}, ${r.provider}, ${r.estimateUsd}, 0
          where (select coalesce(sum(usd), 0) from step_costs) + ${r.estimateUsd} <= ${capUsd}
          on conflict (job_id, step, attempt) do nothing
          returning id`),
      );
      if (inserted.length > 0) return 'reserved';
      const existing = await db
        .select({ id: stepCosts.id })
        .from(stepCosts)
        .where(and(eq(stepCosts.jobId, r.jobId), eq(stepCosts.step, r.step), eq(stepCosts.attempt, r.attempt)))
        .limit(1);
      return existing.length > 0 ? 'exists' : 'over_cap';
    },
    async settle(jobId, step, attempt, usd, ms) {
      await db
        .update(stepCosts)
        .set({ usd, ms })
        .where(and(eq(stepCosts.jobId, jobId), eq(stepCosts.step, step), eq(stepCosts.attempt, attempt)));
    },
    async total() {
      const [row] = await db.select({ usd: sum(stepCosts.usd) }).from(stepCosts);
      return Number(row?.usd ?? 0);
    },
  };
}
