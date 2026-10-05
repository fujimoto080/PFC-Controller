import 'server-only';
import { AsyncLocalStorage } from 'node:async_hooks';

interface QueryTiming {
  sql: string;
  ms: number;
}

const storage = new AsyncLocalStorage<QueryTiming[]>();

/** fn の中で実行された DB クエリの所要時間を集めて返す。 */
export async function collectQueryTimings<T>(
  fn: () => Promise<T>,
): Promise<{ result: T; timings: QueryTiming[] }> {
  const timings: QueryTiming[] = [];
  const result = await storage.run(timings, fn);
  return { result, timings };
}

/** クエリを実行して所要時間を記録する。計測中でなければそのまま実行する。 */
export async function timeQuery<T>(
  query: string | { text: string },
  run: () => Promise<T>,
): Promise<T> {
  const timings = storage.getStore();
  if (!timings) return run();
  const startedAt = performance.now();
  try {
    return await run();
  } finally {
    timings.push({
      sql: typeof query === 'string' ? query : query.text,
      ms: performance.now() - startedAt,
    });
  }
}

const MAX_ENTRIES = 20;
const DESC_LENGTH = 40;

/** Server-Timing の値。合計に加え、遅い順にクエリごとの所要時間を載せる（SQL は先頭だけ）。 */
export function formatServerTiming(
  totalMs: number,
  timings: readonly QueryTiming[],
): string {
  const dbMs = timings.reduce((sum, timing) => sum + timing.ms, 0);
  const entries = [`total;dur=${totalMs.toFixed(1)}`];
  if (timings.length > 0) {
    entries.push(`db;dur=${dbMs.toFixed(1)};desc="${timings.length} queries"`);
  }
  const slowest = [...timings]
    .sort((a, b) => b.ms - a.ms)
    .slice(0, MAX_ENTRIES);
  slowest.forEach((timing, index) => {
    const desc = timing.sql
      .replaceAll(/\s+/g, ' ')
      .trim()
      .slice(0, DESC_LENGTH)
      .replaceAll('"', "'");
    entries.push(`q${index + 1};dur=${timing.ms.toFixed(1)};desc="${desc}"`);
  });
  return entries.join(', ');
}
