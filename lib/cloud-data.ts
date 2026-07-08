import 'server-only';

import { getCloudDataStore } from '@/lib/persistent-store';

// クラウド側で扱うリソース種別（foods は行単位 REST /api/foods に移行済み）
export type CloudResource = 'settings' | 'sports';

export async function getUserData(userId: string) {
  return getCloudDataStore().get(userId);
}

export async function saveUserResource(
  userId: string,
  resource: CloudResource,
  value: unknown,
): Promise<void> {
  await getCloudDataStore().replace(userId, resource, value);
}
