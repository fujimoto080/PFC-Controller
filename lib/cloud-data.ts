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

export async function insertCloudSettings(
  syncKey: string,
  settings: Record<string, unknown>,
  updatedAt: number,
) {
  await runCloudDataWrite((db) => db.insertSettings(syncKey, settings, updatedAt));
}

export async function updateCloudSettings(
  syncKey: string,
  settings: Record<string, unknown>,
  updatedAt: number,
) {
  await runCloudDataWrite((db) => db.updateSettings(syncKey, settings, updatedAt));
}

export async function insertCloudLogs(
  syncKey: string,
  logs: Record<string, unknown>,
  updatedAt: number,
) {
  await runCloudDataWrite((db) => db.insertLogs(syncKey, logs, updatedAt));
}

export async function updateCloudLogs(
  syncKey: string,
  logs: Record<string, unknown>,
  updatedAt: number,
) {
  await runCloudDataWrite((db) => db.updateLogs(syncKey, logs, updatedAt));
}

export async function insertCloudFoods(
  syncKey: string,
  foods: unknown[],
  updatedAt: number,
) {
  await runCloudDataWrite((db) => db.insertFoods(syncKey, foods, updatedAt));
}

export async function updateCloudFoods(
  syncKey: string,
  foods: unknown[],
  updatedAt: number,
) {
  await runCloudDataWrite((db) => db.updateFoods(syncKey, foods, updatedAt));
}

export async function insertCloudSports(
  syncKey: string,
  sports: unknown[],
  updatedAt: number,
) {
  await runCloudDataWrite((db) => db.insertSports(syncKey, sports, updatedAt));
}

export async function updateCloudSports(
  syncKey: string,
  sports: unknown[],
  updatedAt: number,
) {
  await runCloudDataWrite((db) => db.updateSports(syncKey, sports, updatedAt));
}
