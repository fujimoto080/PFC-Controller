import 'server-only';

import { Redis } from '@upstash/redis';
import { CloudDataPayload, isCloudDataPayload } from '@/lib/cloud-payload';

const redis = Redis.fromEnv();

const LEGACY_KEY_PREFIXES = [
  'cloud:data:',
  'cloud-data:',
  'pfc:cloud:',
  'pfc:cloud-data:',
] as const;

interface LegacyCloudRawRecord {
  payload?: unknown;
  updatedAt?: unknown;
}

export interface LegacyCloudData {
  payload: CloudDataPayload;
  updatedAt: number;
}

function normalizeSyncKey(syncKey: string): string {
  return syncKey.trim();
}

function parseLegacyValue(value: unknown): LegacyCloudData | null {
  if (isCloudDataPayload(value)) {
    return {
      payload: value,
      updatedAt: Date.now(),
    };
  }

  if (!value || typeof value !== 'object') return null;

  const record = value as LegacyCloudRawRecord;
  if (!isCloudDataPayload(record.payload)) return null;

  const updatedAt =
    typeof record.updatedAt === 'number' && Number.isFinite(record.updatedAt)
      ? record.updatedAt
      : Date.now();

  return {
    payload: record.payload,
    updatedAt,
  };
}

export async function getLegacyCloudData(
  syncKey: string,
): Promise<LegacyCloudData | null> {
  const normalizedSyncKey = normalizeSyncKey(syncKey);
  if (!normalizedSyncKey) return null;

  for (const prefix of LEGACY_KEY_PREFIXES) {
    const key = `${prefix}${normalizedSyncKey}`;
    const value = await redis.get<unknown>(key);
    const parsed = parseLegacyValue(value);
    if (parsed) {
      return parsed;
    }
  }

  return null;
}
