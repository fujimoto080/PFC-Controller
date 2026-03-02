import 'server-only';

import { Redis } from '@upstash/redis';
import { BackupPayload } from '@/lib/backup';

const redis = Redis.fromEnv();
const CLOUD_DATA_PREFIX = 'pfc:cloud-data';

function normalizeSyncKey(syncKey: string): string {
  return syncKey.trim();
}

function buildCloudDataKey(syncKey: string): string {
  return `${CLOUD_DATA_PREFIX}:${normalizeSyncKey(syncKey)}`;
}

function buildCloudDataUpdatedAtKey(syncKey: string): string {
  return `${buildCloudDataKey(syncKey)}:updated-at`;
}

export async function getCloudData(syncKey: string): Promise<{
  payload: BackupPayload | null;
  updatedAt: number;
}> {
  const [payload, updatedAtRaw] = await Promise.all([
    redis.get<BackupPayload>(buildCloudDataKey(syncKey)),
    redis.get<number>(buildCloudDataUpdatedAtKey(syncKey)),
  ]);

  const updatedAt =
    typeof updatedAtRaw === 'number' && Number.isFinite(updatedAtRaw)
      ? updatedAtRaw
      : 0;

  return {
    payload: payload ?? null,
    updatedAt,
  };
}

export async function setCloudData(
  syncKey: string,
  payload: BackupPayload,
  updatedAt: number,
) {
  await Promise.all([
    redis.set(buildCloudDataKey(syncKey), payload),
    redis.set(buildCloudDataUpdatedAtKey(syncKey), updatedAt),
  ]);
}
