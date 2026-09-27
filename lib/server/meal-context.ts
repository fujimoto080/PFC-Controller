import 'server-only';

import { burnedCalories, computeDailyLimit, subtractPFC } from '@/lib/pfc';
import { getLogsBetween, getUserData } from '@/lib/server/user-data';
import {
  EMPTY_PFC,
  type DailyLog,
  type FoodItem,
  type PFC,
  type SportActivityLog,
} from '@/lib/types';
import { formatDate, formatTime, shiftDate } from '@/lib/utils';

// AI（MCP 連携・食事提案）に渡す摂取状況と食事履歴の組み立て。

export function pfcOf({ protein, fat, carbs, calories }: PFC): PFC {
  return { protein, fat, carbs, calories };
}

export function toMeal(item: FoodItem) {
  return {
    time: formatTime(item.timestamp),
    name: item.name,
    store: item.store,
    ...pfcOf(item),
  };
}

export function toActivity(activity: SportActivityLog) {
  return {
    time: formatTime(activity.timestamp),
    name: activity.name,
    caloriesBurned: activity.caloriesBurned,
  };
}

function toDay(log: DailyLog) {
  return {
    date: log.date,
    total: log.total,
    burnedCalories: burnedCalories(log),
    meals: [...log.items].sort((a, b) => a.timestamp - b.timestamp).map(toMeal),
    activities: log.activities.map(toActivity),
  };
}

export async function getNutritionStatus(userId: string, date: string) {
  // 上限は前日までの超過（負債）に依存するため全履歴を読む
  const { logs, settings } = await getUserData(userId);
  const {
    limit,
    debt,
    burnedCalories: burned,
    isCheatDay,
    cheatDayCap,
  } = computeDailyLimit(date, settings.targetPFC, logs);
  const log = logs[date];
  const consumed = log?.total ?? { ...EMPTY_PFC };
  const now = Date.now();
  return {
    date,
    currentTime: formatDate(now) === date ? formatTime(now) : undefined,
    baseTarget: settings.targetPFC,
    burnedCalories: burned,
    debt,
    limit,
    consumed,
    remaining: subtractPFC(limit, consumed),
    /** チートデーなら true。上限を超えても負債にならない */
    isCheatDay,
    /** チートデーで負債を免除する超過の上限。null なら無制限 */
    cheatDayCap,
    meals: log ? toDay(log).meals : [],
    activities: log ? log.activities.map(toActivity) : [],
    profile: settings.profile,
    /** 苦手な食材・お店ごとの定番メニュー */
    mealPreferences: settings.mealPreferences,
  };
}

/** 今日を含む直近 days 日分の日別記録（記録の無い日は含まない）。 */
export async function getMealHistory(userId: string, days: number) {
  const today = formatDate(Date.now());
  const logs = await getLogsBetween(userId, shiftDate(today, 1 - days), today);
  return Object.values(logs)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(toDay);
}
