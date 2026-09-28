import 'server-only';

import { getPool } from '@/lib/server/db';
import type { UsageEventKind, UsageSummaryRow } from '@/lib/types';

interface UsageEvent {
  kind: UsageEventKind;
  name: string;
  path: string | null;
}

export async function recordUsageEvents(
  userId: string,
  events: UsageEvent[],
): Promise<void> {
  await getPool().query(
    `INSERT INTO pfc_usage_events (user_id, kind, name, path)
     SELECT $1, * FROM unnest($2::text[], $3::text[], $4::text[])`,
    [
      userId,
      events.map(({ kind }) => kind),
      events.map(({ name }) => name),
      events.map(({ path }) => path),
    ],
  );
}

/** 種類・名前・画面ごとに集計する。よく使うものから並べる。 */
export async function listUsageSummary(
  userId: string,
): Promise<UsageSummaryRow[]> {
  const result = await getPool().query<UsageSummaryRow>(
    `SELECT kind, name, path, count(*)::int AS count,
       max(created_at) AS "lastUsedAt"
     FROM pfc_usage_events
     WHERE user_id = $1
     GROUP BY kind, name, path
     ORDER BY count DESC, "lastUsedAt" DESC`,
    [userId],
  );
  return result.rows;
}
