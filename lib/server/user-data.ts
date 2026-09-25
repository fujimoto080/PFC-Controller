import 'server-only';

import { listFoods } from '@/lib/server/foods';
import { listLogActivities } from '@/lib/server/log-activities';
import { listLogItems } from '@/lib/server/log-items';
import { getSettings } from '@/lib/server/settings';
import { listSports } from '@/lib/server/sports';
import { sumPFC } from '@/lib/pfc';
import {
  createEmptyDailyLog,
  type Logs,
  type SportDefinition,
  type UserData,
  type UserSettings,
} from '@/lib/types';

const DEFAULT_SETTINGS: UserSettings = {
  targetPFC: { protein: 100, fat: 60, carbs: 250, calories: 2000 },
  favoriteFoodIds: [],
};

const DEFAULT_SPORTS: SportDefinition[] = [
  { id: 'walking', name: 'ウォーキング', caloriesBurned: 180 },
  { id: 'running', name: 'ランニング', caloriesBurned: 320 },
  { id: 'cycling', name: 'サイクリング', caloriesBurned: 260 },
];

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

  return {
    logs,
    settings: settings ?? DEFAULT_SETTINGS,
    foods,
    sports: sports.length > 0 ? sports : DEFAULT_SPORTS,
  };
}
