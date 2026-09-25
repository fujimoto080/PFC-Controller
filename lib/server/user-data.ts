import 'server-only';

import { listFoods } from '@/lib/server/foods';
import {
  listLogActivities,
  listLogActivitiesBetween,
} from '@/lib/server/log-activities';
import { listLogItems, listLogItemsBetween } from '@/lib/server/log-items';
import { getSettings } from '@/lib/server/settings';
import { listSports } from '@/lib/server/sports';
import { sumPFC } from '@/lib/pfc';
import {
  createEmptyDailyLog,
  type FoodItem,
  type Logs,
  type SportActivityLog,
  type UserData,
} from '@/lib/types';

type Dated<T> = T & { date: string };

function groupLogs(
  items: Dated<FoodItem>[],
  activities: Dated<SportActivityLog>[],
): Logs {
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
  return logs;
}

export async function getUserData(userId: string): Promise<UserData> {
  const [settings, items, activities, foods, sports] = await Promise.all([
    getSettings(userId),
    listLogItems(userId),
    listLogActivities(userId),
    listFoods(userId),
    listSports(userId),
  ]);
  return {
    logs: groupLogs(items, activities),
    settings,
    foods,
    sports,
  };
}

/** from〜to（両端含む, YYYY-MM-DD）の日別ログ。記録の無い日は含まない。 */
export async function getLogsBetween(
  userId: string,
  from: string,
  to: string,
): Promise<Logs> {
  const [items, activities] = await Promise.all([
    listLogItemsBetween(userId, from, to),
    listLogActivitiesBetween(userId, from, to),
  ]);
  return groupLogs(items, activities);
}
