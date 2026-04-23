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
