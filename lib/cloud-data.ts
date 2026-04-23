import 'server-only';

import { CloudDataPayload } from '@/lib/cloud-payload';
import { getCloudDataStore } from '@/lib/persistent-store';

export async function getCloudData(syncKey: string): Promise<{
  payload: CloudDataPayload | null;
  updatedAt: number;
}> {
  const store = getCloudDataStore();
  return store.get(syncKey);
}

export async function setCloudData(
  syncKey: string,
  payload: CloudDataPayload,
  updatedAt: number,
) {
  const store = getCloudDataStore();
  await store.set(syncKey, payload, updatedAt);
}

export async function setCloudSettings(
  syncKey: string,
  settings: Record<string, unknown>,
  updatedAt: number,
) {
  const store = getCloudDataStore();
  await store.setSettings(syncKey, settings, updatedAt);
}

export async function setCloudLogs(
  syncKey: string,
  logs: Record<string, unknown>,
  updatedAt: number,
) {
  const store = getCloudDataStore();
  await store.setLogs(syncKey, logs, updatedAt);
}

export async function setCloudFoods(
  syncKey: string,
  foods: unknown[],
  updatedAt: number,
) {
  const store = getCloudDataStore();
  await store.setFoods(syncKey, foods, updatedAt);
}

export async function setCloudSports(
  syncKey: string,
  sports: unknown[],
  updatedAt: number,
) {
  const store = getCloudDataStore();
  await store.setSports(syncKey, sports, updatedAt);
}
