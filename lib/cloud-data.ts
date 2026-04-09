import 'server-only';

import { BackupPayload } from '@/lib/backup';
import { getCloudDataStore } from '@/lib/persistent-store';

export async function getCloudData(syncKey: string): Promise<{
  payload: BackupPayload | null;
  updatedAt: number;
}> {
  const store = getCloudDataStore();
  return store.get(syncKey);
}

export async function setCloudData(
  syncKey: string,
  payload: BackupPayload,
  updatedAt: number,
) {
  const store = getCloudDataStore();
  await store.set(syncKey, payload, updatedAt);
}
