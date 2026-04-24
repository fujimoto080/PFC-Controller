import 'server-only';

import { getCloudDataStore } from '@/lib/persistent-store';

export async function getUserData(userId: string) {
  return getCloudDataStore().get(userId);
}

export async function saveUserSettings(
  userId: string,
  settings: Record<string, unknown>,
) {
  await getCloudDataStore().replaceSettings(userId, settings);
}

export async function saveUserLogs(
  userId: string,
  logs: Record<string, unknown>,
) {
  await getCloudDataStore().replaceLogs(userId, logs);
}

export async function saveUserFoods(userId: string, foods: unknown[]) {
  await getCloudDataStore().replaceFoods(userId, foods);
}

export async function saveUserSports(userId: string, sports: unknown[]) {
  await getCloudDataStore().replaceSports(userId, sports);
}
