import 'server-only';

import { listFoods } from '@/lib/server/foods';
import { listLogActivities } from '@/lib/server/log-activities';
import { listLogItems } from '@/lib/server/log-items';
import { getSettings } from '@/lib/server/settings';
import { listSports } from '@/lib/server/sports';
import { sumPFC } from '@/lib/pfc';
import { createEmptyDailyLog, type Logs, type UserData } from '@/lib/types';

export async function getUserData(userId: string): Promise<UserData> {
  const [settings, items, activities, foods, sports] = await Promise.all([
    getSettings(userId),
    listLogItems(userId),
    listLogActivities(userId),
    listFoods(userId),
    listSports(userId),
  ]);

  const logs: Logs = {};
  for (const { date, ...item } of items) {
    (logs[date] ??= createEmptyDailyLog(date)).items.push(item);
  }
  for (const { date, ...activity } of activities) {
    (logs[date] ??= createEmptyDailyLog(date)).activities.push(activity);
  }
  for (const log of Object.values(logs)) {
    log.total = sumPFC(log.items);
  }

  return { logs, settings, foods, sports };
}
