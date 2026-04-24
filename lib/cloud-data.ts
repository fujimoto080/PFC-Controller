import 'server-only';

import { CloudDataPayload } from '@/lib/cloud-payload';
import { getDb } from '@/lib/db';

type CloudDataWriteInput = {
  setSettings: Record<string, unknown>;
  setLogs: Record<string, unknown>;
  setFoods: unknown[];
  setSports: unknown[];
};

export async function getCloudData(syncKey: string): Promise<{
  payload: CloudDataPayload | null;
  updatedAt: number;
}> {
  const db = getDb();
  return db.get(syncKey);
}

export async function setCloudData(
  syncKey: string,
  payload: CloudDataPayload,
  updatedAt: number,
) {
  const db = getDb();
  await db.set(syncKey, payload, updatedAt);
}

async function writeCloudDataByKey<K extends keyof CloudDataWriteInput>(
  key: K,
  syncKey: string,
  value: CloudDataWriteInput[K],
  updatedAt: number,
) {
  const db = getDb();

  switch (key) {
    case 'setSettings':
      await db.setSettings(syncKey, value, updatedAt);
      break;
    case 'setLogs':
      await db.setLogs(syncKey, value, updatedAt);
      break;
    case 'setFoods':
      await db.setFoods(syncKey, value, updatedAt);
      break;
    case 'setSports':
      await db.setSports(syncKey, value, updatedAt);
      break;
    default:
      key satisfies never;
  }
}

export async function setCloudSettings(
  syncKey: string,
  settings: Record<string, unknown>,
  updatedAt: number,
) {
  await writeCloudDataByKey('setSettings', syncKey, settings, updatedAt);
}

export async function setCloudLogs(
  syncKey: string,
  logs: Record<string, unknown>,
  updatedAt: number,
) {
  await writeCloudDataByKey('setLogs', syncKey, logs, updatedAt);
}

export async function setCloudFoods(
  syncKey: string,
  foods: unknown[],
  updatedAt: number,
) {
  await writeCloudDataByKey('setFoods', syncKey, foods, updatedAt);
}

export async function setCloudSports(
  syncKey: string,
  sports: unknown[],
  updatedAt: number,
) {
  await writeCloudDataByKey('setSports', syncKey, sports, updatedAt);
}
