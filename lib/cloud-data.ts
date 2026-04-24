import 'server-only';

import { CloudDataPayload } from '@/lib/cloud-payload';
import { getDb } from '@/lib/db';

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

async function runCloudDataWrite(
  writer: (db: ReturnType<typeof getDb>) => Promise<void>,
) {
  const db = getDb();
  await writer(db);
}

export async function setCloudSettings(
  syncKey: string,
  settings: Record<string, unknown>,
  updatedAt: number,
) {
  await runCloudDataWrite((db) => db.setSettings(syncKey, settings, updatedAt));
}

export async function setCloudLogs(
  syncKey: string,
  logs: Record<string, unknown>,
  updatedAt: number,
) {
  await runCloudDataWrite((db) => db.setLogs(syncKey, logs, updatedAt));
}

export async function setCloudFoods(
  syncKey: string,
  foods: unknown[],
  updatedAt: number,
) {
  await runCloudDataWrite((db) => db.setFoods(syncKey, foods, updatedAt));
}

export async function setCloudSports(
  syncKey: string,
  sports: unknown[],
  updatedAt: number,
) {
  await runCloudDataWrite((db) => db.setSports(syncKey, sports, updatedAt));
}
