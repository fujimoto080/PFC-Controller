import 'server-only';

import { getCloudDataStore } from '@/lib/persistent-store';

// クラウド側で扱うリソース種別
export type CloudResource = 'settings' | 'foods' | 'sports';

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
