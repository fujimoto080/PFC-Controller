import { Redis } from '@upstash/redis';
import type { ExternalIntakeLog } from '@/lib/external-intake';

const EXTERNAL_INTAKE_KEY_PREFIX = 'intake:external:';
const EXTERNAL_INTAKE_INDEX_KEY = 'intake:external:index';

const redis = Redis.fromEnv();

type ScoreBoundary = number | '-inf' | '+inf';

const buildExternalIntakeKey = (id: string) => `${EXTERNAL_INTAKE_KEY_PREFIX}${id}`;

const parseLimit = (limit: number): number => {
  if (!Number.isFinite(limit) || limit <= 0) return 50;
  return Math.min(Math.trunc(limit), 200);
};

const toLowerBoundary = (value?: number): ScoreBoundary =>
  Number.isFinite(value) ? (value as number) : '-inf';

const toUpperBoundary = (value?: number): ScoreBoundary =>
  Number.isFinite(value) ? (value as number) : '+inf';

export async function saveExternalIntakeLogs(logs: ExternalIntakeLog[]): Promise<void> {
  await Promise.all(
    logs.map(async (log) => {
      const key = buildExternalIntakeKey(log.id);
      await redis.set(key, log);
      await redis.zadd(EXTERNAL_INTAKE_INDEX_KEY, { score: log.consumedAt, member: log.id });
    }),
  );
}

export async function listExternalIntakeLogs(options?: {
  limit?: number;
  startAt?: number;
  endAt?: number;
}): Promise<ExternalIntakeLog[]> {
  const limit = parseLimit(options?.limit ?? 50);
  const startAt = toLowerBoundary(options?.startAt);
  const endAt = toUpperBoundary(options?.endAt);

  const ids = await redis.zrange<string[]>(EXTERNAL_INTAKE_INDEX_KEY, endAt, startAt, {
    byScore: true,
    rev: true,
    offset: 0,
    count: limit,
  });

  if (!ids.length) {
    return [];
  }

  const logs = await Promise.all(ids.map(async (id) => redis.get<ExternalIntakeLog>(buildExternalIntakeKey(id))));

  return logs.filter((log): log is ExternalIntakeLog => !!log);
}
