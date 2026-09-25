import 'server-only';

import { listFoods } from '@/lib/server/foods';
import { listLogItems } from '@/lib/server/log-items';
import { getSettings } from '@/lib/server/settings';
import { sumPFC } from '@/lib/pfc';
import {
  createEmptyDailyLog,
  type Logs,
  type UserData,
  type UserSettings,
} from '@/lib/types';

const DEFAULT_SETTINGS: UserSettings = {
  targetPFC: { protein: 100, fat: 60, carbs: 250, calories: 2000 },
  favoriteFoodIds: [],
};

export async function getUserData(userId: string): Promise<UserData> {
  const [settings, items, foods] = await Promise.all([
    getSettings(userId),
    listLogItems(userId),
    listFoods(userId),
  ]);

  const logs: Logs = {};
  for (const { date, ...item } of items) {
    (logs[date] ??= createEmptyDailyLog(date)).items.push(item);
  }
  for (const log of Object.values(logs)) {
    log.total = sumPFC(log.items);
  }

  return {
    logs,
    settings: settings ?? DEFAULT_SETTINGS,
    foods,
  };
}
